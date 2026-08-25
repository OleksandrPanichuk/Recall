# Personal Learning Quiz Bot

Персональний Telegram-бот для активного навчання: Claude перетворює книгу, PDF, конспект або транскрипт на структурований набір запитань і передає його через MCP, а бот проводить тести, пояснює помилки та зберігає прогрес.

> **Статус:** Stable Personal Release, у процесі rewrite-у на v2. Phases 1-6 виконані: domain models, persistence, application use cases, Telegram-бот, MCP server, adaptive practice і operations (graceful shutdown, privacy-safe logs, health command). Quiz data переїхала зі `bun:sqlite` на Postgres — див. [REWRITE_PLAN.md](REWRITE_PLAN.md).

## Як має працювати продукт

```text
Книга / PDF / стаття / транскрипт
                  |
                  v
               Claude
         генерує набір тестів
                  |
                  v
          local MCP server
                  |
                  v
            Postgres database
                  ^
                  |
            Telegram-бот
                  |
                  v
      тести -> пояснення -> прогрес
```

У першій версії Claude потрібен лише для створення навчальних наборів. Опубліковані тести перевіряються звичайним кодом, тому їх проходження не потребує Claude API та не створює додаткових AI-витрат.

Заплановані можливості:

- імпорт наборів із Claude через MCP;
- `single_choice`, `multiple_choice` і `true_false` питання;
- пояснення та посилання на розділ джерела;
- збереження й продовження незавершеної спроби;
- результати за наборами й темами;
- персональний доступ через Telegram user allowlist.

## Документація

- [DESCRIPTION.md](DESCRIPTION.md) — повна продуктова концепція та майбутня архітектура.
- [ARCHITECTURE.md](ARCHITECTURE.md) — binding patterns, dependency rules, folder ownership і target structure для нової реалізації.
- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) — покроковий roadmap, acceptance gates і release milestones.
- [WORKFLOW.md](WORKFLOW.md) — agent workflow: implement, review, fix і scoped re-review.
- [AGENTS.md](AGENTS.md) — repository instructions для Codex та інших coding agents.
- [CLAUDE.md](CLAUDE.md) — runtime та repository instructions для Claude Code.
- [skills/run-reviewed-development](skills/run-reviewed-development/SKILL.md) — reusable cross-platform orchestration skill.

## Технології

- [Bun](https://bun.com) — runtime, package manager, build і test runner;
- TypeScript;
- [Telegraf](https://telegraf.js.org) — запланований Telegram Bot framework;
- Postgres 17 + [Drizzle ORM](https://orm.drizzle.team) над driver-ом `postgres` —
  quiz data, schema, versioned migrations і всі repository-запити;
- `bun:sqlite` — залишився тільки під MCP OAuth client credentials
  (`OAUTH_DATABASE_PATH`); phase 7 замінює його на Better Auth;
- Model Context Protocol — запланована інтеграція з Claude Desktop/Claude Code.

## Поточна локальна foundation

### Передумови

- Bun;
- Docker — для локального Postgres (`bun run db:up`).

### Налаштування

Встановити dependencies:

```bash
bun install
```

Створити локальний `.env` із шаблону та заповнити значення:

```bash
cp .env.example .env
```

| Змінна | Призначення |
| --- | --- |
| `TELEGRAM_BOT_KEY` | Токен бота з @BotFather |
| `ALLOWED_TELEGRAM_USER_ID` | Єдиний Telegram user id, якому дозволено доступ |
| `DATABASE_URL` | Postgres connection string для quiz data |
| `APP_TIMEZONE` | IANA time zone для дат у звітах |
| `OAUTH_DATABASE_PATH` | SQLite файл із MCP OAuth credentials (default `./data/oauth.sqlite`) |

Перші чотири змінні обов'язкові, `OAUTH_DATABASE_PATH` має default. `apps/api/src/infrastructure/config/env.ts` валідує їх на
старті через zod і, якщо конфігурація некоректна, виводить список усіх проблем
одразу та завершує процес із кодом `1`. У повідомленні про помилку є лише назви
змінних і причини — секретні значення не логуються, тому токен не потрапляє в
logs. Водночас це не означає, що приховуються всі значення: startup друкує
нешкідливий `APP_TIMEZONE`, а `DATABASE_URL` друкується без пароля —
`postgres://recall@127.0.0.1:55432/recall`, щоб оператор бачив, з якою базою
працює процес, і щоб credentials не потрапили в logs.

Підняти локальний Postgres 17 у Docker (порт 55432) і застосувати migrations:

```bash
bun run db:up       # docker compose up -d --wait
bun run db:migrate  # drizzle-kit migrate проти DATABASE_URL
```

`bun run db:down` зупиняє контейнер, `bun run db:reset` ще й витирає volume.
`bun run up` робить це сам: перед стартом сервісів він перевіряє, що
`DATABASE_URL` відповідає, і застосовує pending migrations — інакше не
запускає нічого.

Schema описана в `apps/api/src/persistence/postgres/schema.ts`. Після її зміни
потрібно згенерувати нову migration:

```bash
bun run db:generate
```

Migration filename генерує drizzle-kit і перейменовує його на кожній
регенерації, тому ні tests, ні ETL його не хардкодять — вони читають найновіший
`.sql` із `apps/api/drizzle-postgres/`.

### Перенесення даних із SQLite (v1)

ETL читає старий `bun:sqlite` файл напряму і пише в Postgres ідемпотентно, а
тоді сам себе перевіряє — table за table, плюс кількість правильних відповідей і
цілісність foreign keys:

```bash
cd apps/api
APPLY_SCHEMA=1 bun run ./scripts/migrate-to-postgres.ts \
  ../../data/quiz.before-postgres-20260823-170412.sqlite \
  postgres://recall:recall@127.0.0.1:55432/recall
```

`APPLY_SCHEMA=1` спершу накладає schema на порожню базу. Без нього ETL очікує,
що migrations уже застосовані. Ids детерміновані (`uuidFor(kind, legacyId)`),
тому повторний запуск нічого не дублює. Старий SQLite файл залишається
read-only escape hatch — не видаляйте його.

### SQLite, що залишився

Нижче — правила для `bun:sqlite` migrations. Після переходу на Postgres вони
стосуються **тільки** OAuth-файла (`OAUTH_DATABASE_PATH`) і його schema в
`apps/api/src/adapters/persistence/sqlite/schema.ts`; phase 7 прибирає і це.

> **Важливо:** Drizzle schema builder не вміє виражати `STRICT`, тому в кожному
> згенерованому `.sql` файлі кожен `CREATE TABLE` доводиться вручну завершувати
> `) STRICT;`. Наслідки втрати цієї правки різні залежно від того, що згенерував
> `drizzle-kit`:
>
> - у новій таблиці SQLite почне приймати BLOB у TEXT column і `1.5` у
>   `telegram_user_id`;
> - у table-rebuild migration (див. нижче) перестворена таблиця не лише втрачає
>   `STRICT`, а й **втрачає всі дочірні рows** через `ON DELETE CASCADE`.
>
> Integration test `strict typing` падає, якщо правку втратити.

### Table-rebuild migrations

SQLite не вміє змінювати `CHECK`, тому будь-яка зміна enum-списку змушує
`drizzle-kit generate` видати 12-step rebuild: `CREATE TABLE __new_<name>`,
`INSERT ... SELECT`, `DROP TABLE <name>`, `ALTER TABLE ... RENAME TO`.

Такий файл **не можна** застосовувати всередині однієї транзакції з рештою
migrations: `PRAGMA foreign_keys` всередині транзакції — тихий no-op, тому
foreign keys залишаються увімкненими на `DROP TABLE`, кожен `ON DELETE CASCADE`
спрацьовує, і весь дочірній graph зникає — а migration завершується кодом `0`.

Тому rebuild оголошується явно: **перший рядок файлу — `-- rebuild`**. Тоді
`applyMigrations`:

1. застосовує всі попередні safe migrations одним batch (усе або нічого);
2. вимикає `PRAGMA foreign_keys` **поза** транзакцією, відкриває
   `BEGIN IMMEDIATE` і виконує statements файлу (рядки `PRAGMA foreign_keys`
   всередині файлу ігноруються — вони були б no-op);
3. запускає `PRAGMA foreign_key_check`. Якщо є хоч один row — `ROLLBACK`,
   `RebuildFailedError`, у ledger нічого не пишеться;
4. якщо чисто — пише ledger record і робить `COMMIT`, потім вмикає
   `PRAGMA foreign_keys` назад.

Файл rebuild-у, у якому є `PRAGMA foreign_keys` або `__new_`, але немає
директиви `-- rebuild`, відхиляється з `UnsafeMigrationError` — щоб випадковий
rebuild не проїхав як звичайна migration.

Не забудьте дописати `) STRICT;` до кожного `CREATE TABLE`, включно з
`__new_*`: drizzle-kit його не генерує.

> `questions.type` навмисно **не має** `CHECK`. Кожен новий тип питання
> означав би новий rebuild; натомість значення валідує `createQuestion`.

## Команди

| Command | Призначення |
| --- | --- |
| `bun run dev` | Запустити бота у watch mode (потрібне підняте API) |
| `bun run bot` | Запустити бота |
| `bun run db:up` | Підняти Postgres 17 у Docker на порту 55432 |
| `bun run db:down` | Зупинити Postgres |
| `bun run db:reset` | Зупинити Postgres і витерти volume |
| `bun run db:migrate` | Застосувати pending Postgres migrations до `DATABASE_URL` |
| `bun run db:generate` | Згенерувати migration зі змін у Drizzle schema |
| `bun run etl -- <файл> [url]` | Перенести v1 SQLite файл у Postgres і перевірити результат |
| `bun run lint` | Перевірити код правилами Biome linter |
| `bun run lint:fix` | Автоматично виправити safe lint findings |
| `bun run format:check` | Перевірити форматування без зміни файлів |
| `bun run format` | Відформатувати підтримувані файли через Biome |
| `bun run check` | Одночасно перевірити lint, formatting та imports |
| `bun run check:fix` | Застосувати safe Biome fixes, formatting та import sorting |
| `bun run typecheck` | Перевірити TypeScript без генерації output |
| `bun run up` | Підняти все, що налаштоване: API (з MCP), бот, адмінка |
| `bun run api` | Підняти API — REST, Swagger, адмін-API і MCP на одному порті |
| `bun run mcp` | stdio-мостик до MCP цього API (для Claude Desktop) |
| `bun run admin` | Підняти веб-адмінку на `http://127.0.0.1:8766` |
| `bun run build` | Зібрати всі entrypoints у `dist/` |
| `bun run start` | Запустити попередньо зібраний `dist/bot/main.js` |
| `bun test` | Запустити Bun unit і contract tests |
| `bun run verify` | Запустити повний local gate: Biome, typecheck, tests і build |

Biome зафіксований як local dev dependency, тому локальна розробка та CI
використовують однакову версію ruleset. VS Code/Cursor автоматично форматує
TypeScript і JSON при збереженні; для інших editor-ів source of truth —
`biome.json` та команди вище.

Legacy publish-bot code і його runtime dependencies видалені. Нові dependencies
потрібно додавати лише разом із behavior, яке їх використовує: `zod` доданий для
валідації конфігурації і буде повторно використаний для MCP schema validation.

## Development roadmap

Реалізація поділена на послідовні фази:

1. **Repository foundation** — Git baseline, `.gitignore`, environment schema та verification scripts.
2. **Domain and persistence** — domain models, schema, migrations та repositories (готово; persistence перенесена на Postgres).
3. **Application services** — authoring, attempts, scoring і statistics (готово).
4. **Telegram interface** — allowlist, меню, quiz flow і results (готово).
5. **MCP authoring** — локальний server та tools для Claude (готово).
6. **Adaptive practice** — повторення та spaced repetition (знято; буде перероблено з нуля).
7. **Reliability** — lifecycle, privacy-safe logging, backup/restore і local deployment (готово).

Детальні work packages та gates описані в [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md).

## Agent development workflow

Для реалізації плану використовується незалежний review loop:

```text
implementer -> focused verification -> reviewer
     ^                                   |
     +--------- fix <- findings ----------+
                       |
                       v
                 scoped re-review
```

Головна agent session працює як coordinator. Вона не схвалює власну реалізацію: кожен task перевіряє окремий read-only reviewer, а кожен fix проходить повторне незалежне review.

Приклад запуску в Codex:

```text
Use $run-reviewed-development to execute <path-to-implementation-plan>.
```

У Claude Code:

```text
Use the run-reviewed-development skill to execute <path-to-implementation-plan>.
```

Перед execution конкретної фази спочатку потрібно створити точний implementation plan через `writing-plans`. Повний процес описаний у [WORKFLOW.md](WORKFLOW.md).

## Поточна структура

Репозиторій — це Bun workspace. Домен, use cases і доступ до бази живуть в
`apps/api`; бот, MCP і адмінка — окремі застосунки, які ходять до API по HTTP і
до бази не мають доступу взагалі. `apps/web` ще не існує — див.
[REWRITE_PLAN.md](REWRITE_PLAN.md).

```text
apps/api/           NestJS: REST, Swagger, /bot/*, /api/* (адмінка) і /mcp
  drizzle/          міграції SQLite (залишилися тільки OAuth-таблиці)
  drizzle-postgres/ міграції Postgres
  scripts/          migrate-to-postgres.ts — ETL з v1 SQLite
apps/bot/           Telegraf-роутер; кожен use case — виклик /bot/* по HTTP
apps/mcp/           stdio-мостик до /mcp того ж API
apps/admin/         react-admin SPA на Bun.serve
packages/
  contracts/        zod-схеми wire-формату + типізований клієнт API
  kit/              спільний runtime: logger, shutdown, daily timer, утиліти
  tooling/          спільний tsconfig base
scripts/            up — supervisor локальних сервісів
```

Всередині `apps/api/src` структура не змінилася:

```text
apps/api/src/
  shared/
    utils/          layer-free date, text and duplicate primitives
  domain/
    quiz-set/       QuizSet, Question and validation model
    quiz-attempt/   QuizAttempt, answer evaluation and scoring model
    folder/         Folder aggregate, naming and placement rules
    branded-id.ts
  application/
    use-case.ts    shared Command and UseCase contracts
    ports/         Clock, IdGenerator and UnitOfWork contracts
      repositories/ page, quiz, attempt, review and term pair contracts
    use-cases/
      quiz-sets/    create, update, add questions, publish, archive
      attempts/     start, pause, resume, answer, finish
      statistics/   per-attempt, per-set, per-topic and improvement figures
      folders/      create, rename, move, delete, ensure path, browse
  adapters/
    persistence/
      sqlite/     only the MCP OAuth store is left here
        database.ts connection lifecycle and SQLite pragmas
        migrator.ts guarded Drizzle migration runner
        schema.ts   Drizzle SQLite schema
        sqlite-transaction.ts Transaction port over bun:sqlite
        repositories/ the OAuth client store
  persistence/
    postgres/
      client.ts    connection pool over the postgres driver
      schema.ts    Drizzle Postgres schema
      unit-of-work.ts transactional scope over drizzle
      etl.ts       the v1 SQLite to Postgres migration and its verification
      repositories/ Drizzle query builders and row mappers
    memory/        the same repositories in memory, behind the contract suites
  infrastructure/
    config/
      env.ts       validated startup configuration
    logging/
      logger.ts       structured, privacy-safe JSON logs on stderr
      logger.types.ts log level, record and logger contracts
      utils/          field redaction, clipping and record formatting
    lifecycle/
      shutdown.ts  ordered teardown on SIGINT/SIGTERM
      backup.ts    consistent backup and restore validation
      status.ts    health report
  adapters/
    mcp/
      server.ts    MCP server construction and tool registration
      tools/       one registrar per MCP tool
      schemas/     zod input schemas
      presenters/  tool result and error text
      utils/       per-call tool logging
  composition/
    create-application.ts  manual dependency injection root
  entrypoints/
    api.ts         starts NestJS: REST, Swagger, /bot/*, admin API and MCP
    status.ts      prints the health report; --check validates and exits
  modules/
    bot/           the internal /bot/* surface the telegram app calls
    content/       public REST over the quizzes
    integration/   mounts the admin and MCP apps
apps/bot/
  src/telegram/    Telegraf wiring, handlers and presenters
  src/config.ts    the bot's own environment; it never sees DATABASE_URL
  src/main.ts      starts the bot; --check validates configuration and exits
apps/mcp/
  src/main.ts      stdio bridge: a local MCP client talks to the api over http
packages/
  contracts/       wire schemas and the typed api client
  kit/             logger, shutdown, daily timer and pure helpers
scripts/
  up.ts            the supervisor: checks Postgres, migrates, starts services
apps/api/tests/
  fixtures/        aggregate builders shared by the integration tests
  contracts/     repository contract suites, run against both engines
  integration/
    postgres/      schema constraints, transactions, the ETL and the status report
skills/
  run-reviewed-development/
.env.example
DESCRIPTION.md
ARCHITECTURE.md
REWRITE_PLAN.md
WORKFLOW.md
AGENTS.md
CLAUDE.md
```

Target structure не створюється наперед порожніми directories. Application use
cases і transport adapters додаватимуться поступово за правилами
[ARCHITECTURE.md](ARCHITECTURE.md).

## Створення наборів через Claude (MCP)

MCP tools живуть в API: той самий процес, що віддає REST і Swagger, віддає і
`/mcp`. Тому Claude ніколи не торкається SQL напряму — і до бази ходить лише
`apps/api`.

`apps/mcp` — це мостик: клієнт (Claude Desktop, Claude Code) запускає його
через stdio, а він переказує кожен JSON-RPC запит на `/mcp` того API.

Спершу підніми API з увімкненим MCP:

```bash
openssl rand -hex 32          # токен, мінімум 32 символи → MCP_HTTP_TOKEN
bun run api                   # REST, Swagger і /mcp на 127.0.0.1:8767
```

Підключення до Claude Code:

```bash
claude mcp add recall-quiz --scope user \
  --env MCP_HTTP_TOKEN=... \
  --env RECALL_API_MCP_URL=http://127.0.0.1:8767/mcp \
  -- bun run /absolute/path/to/repo/apps/mcp/src/main.ts
```

Для Claude Desktop додайте той самий command у `claude_desktop_config.json`
(`mcpServers.recall-quiz`) з абсолютним шляхом і тими ж двома змінними.

| Змінна | Типово | Призначення |
| --- | --- | --- |
| `MCP_HTTP_TOKEN` | — | той самий токен, що в API; обов'язковий |
| `RECALL_API_MCP_URL` | `http://127.0.0.1:8767/mcp` | endpoint API |
| `RECALL_MCP_TIMEOUT_MS` | `120000` | скільки чекати відповідь API |

`bun run mcp --check` перевіряє конфігурацію мостика і виходить. Якщо API не
підняте, мостик не падає: клієнт отримує JSON-RPC error з причиною.

Доступні tools:

| Tool | Призначення |
| --- | --- |
| `quiz_create_set` | створити draft і отримати його id |
| `quiz_add_questions` | додати batch питань атомарно; повторний ідентичний batch — no-op |
| `quiz_update_set` | змінити metadata draft-набору |
| `quiz_get_set` | перечитати набір із id питань і позначеними правильними варіантами |
| `quiz_update_question` | виправити одне питання, зберігши його id та історію |
| `quiz_delete_question` | видалити питання, на яке ще ніхто не відповідав |
| `quiz_list_sets` | список наборів (`includeUnpublished` показує drafts) |
| `quiz_publish_set` | опублікувати набір для проходження в Telegram |
| `quiz_archive_set` | архівувати набір, зберігши історію спроб |
| `quiz_list_folders` | показати дерево папок із кількістю наборів |
| `quiz_ensure_folder_path` | створити шлях папок (створює лише те, чого бракує) |
| `quiz_move_set` | покласти набір у папку або повернути в корінь |
| `quiz_rename_folder` | перейменувати папку |
| `quiz_delete_folder` | видалити порожню папку |

Типовий сценарій: `quiz_create_set` → кілька `quiz_add_questions` → `quiz_get_set`
для перевірки → `quiz_publish_set`. Після цього набір з'являється в Telegram-меню.

> Назви tools використовують `_`, а не `.` як у `DEVELOPMENT_PLAN.md`: MCP-клієнти
> дозволяють у назві лише `[A-Za-z0-9_-]`.


## Віддалений доступ до MCP

`bun run mcp` говорить через stdio — його запускає сам клієнт на цій машині, і
він усе одно ходить у той самий API. Якщо клієнт уміє HTTP сам (Codex,
Claude Code), мостик не потрібен: дай йому напряму `/mcp` того самого API.

```bash
openssl rand -hex 32          # токен, мінімум 32 символи
bun run api                   # /mcp вмикається лише коли є MCP_HTTP_TOKEN
```

Змінні: `MCP_HTTP_TOKEN` (без нього `/mcp` просто не існує — 404),
`API_HOST` (типово `127.0.0.1`), `API_PORT` (типово `8767`),
`MCP_HTTP_ALLOWED_HOST` (хост тунелю).

### Токен — це весь захист

Хто має токен, той **є тобою**: повний доступ на запис до твоїх наборів. Тому:

- сервер слухає **лише loopback** за замовчуванням, а в інтернет його виводить
  тунель — навіть криво налаштований firewall не відкриє його напряму;
- токен коротший за 32 символи startup **відхиляє**, щоб слабкий не проліз;
- порівняння токена йде через SHA-256 і `timingSafeEqual`, тому час відповіді
  не підказує, наскільки збігся префікс;
- задай `MCP_HTTP_ALLOWED_HOST` — і ввімкнеться захист від DNS rebinding, щоб
  браузер на твоїй машині не дійшов до сервера через підмінене імʼя;
- токен не потрапляє в logs: у відмові пишеться лише причина, метод і шлях.

### Тунель

```bash
cloudflared tunnel --url http://127.0.0.1:8767
```

Візьми виданий домен, поклади його в `MCP_HTTP_ALLOWED_HOST` і перезапусти
сервер.

### Підключити клієнта

```bash
# Codex
export RECALL_TOKEN=...
codex mcp add recall-quiz --url https://<домен>/mcp \
  --bearer-token-env-var RECALL_TOKEN

# Claude Code
claude mcp add --transport http recall-quiz https://<домен>/mcp \
  --header "Authorization: Bearer $RECALL_TOKEN"
```

Сесії немає: кожен запит обробляється сам собою, бо всі 19 tools —
запит-відповідь і нічого не пушать. Тому два клієнти одночасно не заважають
одне одному, а база лишається одна, спільна з ботом.

### claude.ai і ChatGPT — через OAuth

У connectors claude.ai і ChatGPT **немає поля для власного заголовка**, тому
статичний токен їм не передати. Вони вміють лише OAuth (або «без авторизації»,
що означає віддати базу будь-кому, хто знає URL). Тому сервер уміє і OAuth:

```bash
MCP_OAUTH_ISSUER=https://<домен>          # публічний url, на якому тебе видно
MCP_OAUTH_PASSPHRASE=<мінімум 16 символів>
```

Обидві змінні задаються **разом**: одна без іншої — і startup відхиляє, щоб не
вийшло відкритого сервера. Без них OAuth просто не вмикається, лишається
статичний токен.

Що відбувається, коли додаєш коннектор:

1. клієнт сам себе реєструє через `/register` (динамічна реєстрація);
2. відкривається `/authorize`, і сервер веде **не назад до клієнта**, а на свою
   сторінку `/consent`;
3. на ній вводиш `MCP_OAUTH_PASSPHRASE` — перевірка та сама, що для токена:
   SHA-256 + `timingSafeEqual`;
4. клієнт отримує код, обмінює його з PKCE-verifier на токени й далі ходить
   зі своїм access-токеном; refresh ротується при кожному використанні.

У базі лежать **лише хеші** кодів і токенів: витік файла не дає живих доступів.
Код одноразовий і живе 60 секунд, access — годину.

**Для ChatGPT додатково потрібні:**

- **Developer Mode** — Settings → Apps → Advanced settings. Без нього кастомний
  коннектор із довільними tools не додати.
- **стабільний домен.** `cloudflared tunnel --url` видає випадковий
  `*.trycloudflare.com`, який змінюється при кожному запуску, — коннектор
  зламається наступного дня. Потрібен named tunnel на власному домені або
  Tailscale Funnel зі стабільним імʼям.

Скасувати доступ: `/revoke` або видалити рядок із `oauth_tokens`.

## Одна команда

```bash
bun run up
```

Спершу вона друкує план — що піднімається і чому щось пропущено:

```
api    http://127.0.0.1:8767/docs
bot    starting
admin  http://127.0.0.1:8766
```

Потім перевіряє, чи вільні порти, застосовує міграції, стартує процеси і
чекає, поки HTTP-сервіси почнуть відповідати:

```
admin  00:06:50 info  admin ready  host=127.0.0.1 port=8766

admin → http://127.0.0.1:8766
api   → http://127.0.0.1:8767/docs
admin password: run with --show-passphrase to print it
ready in 0.4s — Ctrl+C to stop
```

JSON-логи трьох процесів зводяться в одну читабельну колонку, кожен сервіс —
своїм кольором. `Ctrl+C` глушить усе і виходить з нулем.

Якщо порт зайнятий, вона не стартує нічого і каже, хто його тримає:

```
port 8767 (api) is held by pid 24823 (bun) — stop it with: kill 24823
```

| Флаг | Що робить |
| --- | --- |
| `--check` | перевірити конфігурацію і порти, нічого не запускати |
| `--only bot,admin` | підняти лише вибрані сервіси |
| `--open` | відкрити адмінку в браузері, коли вона готова |
| `--show-passphrase` | вивести пароль адмінки в банері |
| `--raw` | не форматувати логи процесів |
| `--no-colour` | без кольорів |

Сервіс пропускається, коли для нього немає конфігурації: MCP — без
`MCP_HTTP_TOKEN`, адмінка — без `ADMIN_PASSPHRASE` та `MCP_OAUTH_PASSPHRASE`.
Якщо падає будь-який процес, решта глушиться, і `up` виходить з його кодом.

## Веб-адмінка

`bun run up` піднімає адмінку разом із ботом і MCP. Окремо:

```bash
bun run admin
# → http://127.0.0.1:8766
```

Пароль — `ADMIN_PASSPHRASE` (мінімум 16 символів). Якщо його не задано,
адмінка бере `MCP_OAUTH_PASSPHRASE`; якщо немає ні того, ні того — `bun run up`
просто не піднімає її. Порт і хост: `ADMIN_PORT`, `ADMIN_HOST`.

Інтерфейс — [react-admin](https://marmelab.com/react-admin/) на власному
JSON-API. Готові списки з пошуком, фільтрами, сортуванням і пагінацією; форми з
валідацією; підтвердження видалення. Кастомного UI-коду мінімум: лише опис
ресурсів.

| Ресурс | Що можна |
| --- | --- |
| Набори | створити, редагувати метадані, перекласти в іншу папку, опублікувати, відправити в архів; таби з питаннями, словником і статистикою |
| Питання | пошук по всіх наборах одразу, фільтри за набором, темою, складністю й типом; додати, відредагувати, видалити |
| Словник | додати пару, виправити терміни та переклади — питання перебудовуються автоматично |
| Папки | створити, перейменувати, перемістити, видалити |
| Налаштування | глобальні та per-set: перемішування, режим екзамену, інтервали повторень; кнопка «успадкувати глобальні» |

Пошук по питаннях дивиться в текст питання, тему, підказку, пояснення, назву
набору і текст варіантів. Кожен рядок показує, скільки разів на це питання
відповідали — саме тому видалення може бути заборонене.

### Що дозволено в якому стані

Ці правила живуть у домені, а не в інтерфейсі:

| Дія | Чернетка | Опублікований | Архів |
| --- | --- | --- | --- |
| Редагувати метадані | ✓ | ✓ | ✗ |
| Додати питання | ✓ | ✓ | ✗ |
| Виправити або видалити питання | ✓ | ✓ | ✗ |
| Видалити останнє питання | ✗ | ✗ | ✗ |
| Видалити питання з відповідями | ✗ | ✗ | ✗ |
| Перекласти в іншу папку | ✓ | ✓ | ✓ |
| Опублікувати | ✓ | — | — |
| В архів | ✓ | ✓ | — |

Повернути набір з архіву або з опублікованого в чернетки не можна.

Сесія — HMAC-cookie на 12 годин, той самий механізм, що й консент для OAuth.
Адмінка слухає loopback: щоб відкрити її з іншої машини, використовуй тунель,
як і для MCP.

## Типи питань

| Тип | Як відповідає користувач | Що автор дає в MCP |
| --- | --- | --- |
| `single_choice` | тап по одному варіанту | `options` |
| `multiple_choice` | тапи + «Відповісти» | `options` |
| `true_false` | тап по одному з двох | `options` |
| `typed_answer` | **пише повідомленням** | `acceptedAnswers` |
| `cloze` | **пише повідомленням** | `acceptedAnswers`, `___` у `prompt` |
| `ordering` | тапає слова по черзі | `orderedItems` (у правильному порядку) |
| `matching` | тапає ліве слово, потім пару | `pairs` |

Типи не прив'язані до англійської: `cloze` так само тренує
`SELECT * ___ users`, а `matching` — HTTP-код ↔ значення.

### Написані відповіді

`typed_answer` і `cloze` перевіряються так:

- регістр, зайві пробіли й крапка в кінці не мають значення;
- **усі види апострофів зводяться до одного**, тому `don't` і `don’t` — та сама
  відповідь (телефон надсилає `’`, а в ключі зазвичай `'`);
- приймається будь-який варіант зі списку — `colour` і `color` окремими рядками;
- **артиклі не відкидаються**: якщо `a decision` теж правильно, додайте його
  окремим рядком. Неявне правило ламалося б там, де `a` — і є відповіддю;
- одрук за один крок Дамерау (включно з перестановкою літер, як
  `recieve`/`receive`) показується як «Майже», але **зараховується як
  помилка** — інакше бот тихо вчив би неправильного написання.

Питання з написаною відповіддю не можна пропустити тапом, тому воно має
`🤔 Не знаю`: відповідь показується, а спроба записується як **skipped** —
це не те саме, що помилка.

```jsonc
quiz_add_questions({ quizSetId, questions: [
  { type: "typed_answer", prompt: "кіт", difficulty: "easy",
    acceptedAnswers: ["cat"] },
  { type: "cloze", prompt: "She has lived here ___ 2019.", difficulty: "medium",
    acceptedAnswers: ["since"] },
  { type: "ordering", prompt: "Build the question", difficulty: "medium",
    orderedItems: ["where", "the station", "is"] },
  { type: "matching", prompt: "Match the words", difficulty: "easy",
    pairs: [{ left: "cat", right: "кіт" }, { left: "dog", right: "пес" }] },
]})
```

`matching` приймає максимум **5 пар**: усі позиції їдуть в одному
`callback_data`, а Telegram обмежує його 64 байтами — 10 пар це 70.

`ordering` і `matching` перемішуються детерміновано за id питання: екран
перемальовується після кожного тапу, і свіже перемішування зсувало б кнопку
з-під пальця.

## Виправлення питань

Одруку видно вже під час навчання — коли питання встигло набрати історію
відповідей і розклад повторень. Тому правка йде **в місці**, зі збереженням id:

```jsonc
quiz_get_set({ quizSetId })                    // звідси беруться id питань
quiz_update_question({
  quizSetId, questionId,
  acceptedAnswers: ["блискавка", "змійка", "повзунок"],
})
```

- Працює й на **опублікованому** наборі: саме там помилки й знаходяться.
  Заархівований — ні.
- Змінюються лише передані поля. Відповіді передаються в тій формі, яку має тип
  питання: `options` для варіантів, `acceptedAnswers` для `typed_answer` і
  `cloze`, `orderedItems` для `ordering`, `pairs` для `matching`. Не та форма —
  відмова, а не тихо зламане питання.
- **Тип змінити не можна.** Інший тип — це інше питання: видали й додай нове.
- id зберігається, тому `repetitionCount`, `lapses` і дата наступного показу
  лишаються на місці — та сама механіка, що в `quiz_update_vocabulary`.

Головний випадок: учень написав правильний синонім, а бот зарахував помилку.
Тоді синонім просто додається до прийнятних відповідей.

### Видалення

```jsonc
quiz_delete_question({ quizSetId, questionId })
```

Відмовляє у двох випадках, і обидва навмисні:

- **на питання вже відповідали** — `question_responses` і розклад повторень
  висять на ньому через `ON DELETE CASCADE`, тож видалення перепише рахунки
  минулих спроб. Правити — можна, знищувати історію — ні;
- **це останнє питання в наборі** — набір не може бути порожнім.

Решта питань зберігають порядок і перенумеровуються.

## Лексика

Пара слів — це **одна сутність** (`vocabulary_items`), з якої генеруються
**картки-питання**: окремо `cat → кіт` і `кіт → cat`.

Причина, чому не одне питання з прапорцем «навпаки»: це різні навички.
Впізнавання (`EN→UA`) дається за кілька повторень, продукування (`UA→EN`)
тягнеться місяцями. Повторення планується по питанню, тому кожен напрямок
має власну криву забування — `cat → кіт` встигає піти на місяць, поки
`кіт → cat` ще ходить щотри дні.

```jsonc
quiz_add_vocabulary({
  quizSetId,
  topic: "Animals",
  direction: "both",        // або "term_to_translation" / "translation_to_term"
  pairs: [
    { term: "cat", translation: ["кіт", "кішка"], transcription: "/kæt/" },
    { term: ["colour", "color"], translation: "колір" },
  ],
})
```

- Будь-яка сторона може бути списком: перший варіант іде в prompt, **усі**
  приймаються як відповідь. Без цього `колір → color` було б помилкою.
- `transcription` показується підказкою лише там, де питають слово (`UA→EN`) —
  у зворотному напрямку вона була б відповіддю.
- `example` лягає в пояснення після відповіді.
- Якщо обидві сторони — те саме слово, генерується одна картка, а не дві
  однакові.
- Повторна відправка тих самих пар — no-op, як і в `quiz_add_questions`.

### Виправлення

Помилку в перекладі видно вже під час навчання — коли картка встигла набрати
історію повторень. Тому правка йде через item, а не через питання:

```jsonc
quiz_list_vocabulary({ quizSetId })            // звідси беруться itemId
quiz_update_vocabulary({ itemId, translation: "кіт" })
```

Обидві картки перебудовуються, **зберігаючи свої id**: `repetitionCount`,
`lapses` і дата наступного показу лишаються на місці. Виправляєш один бік —
чиняться обидва, бо вони й були одним словом.

- Працює й на опублікованому наборі: саме там помилки й знаходяться.
  Заархівований — ні.
- Якщо після правки картка лишається без слова, яке питати (виправив переклад
  рівно в те саме слово), вона видаляється, а не питає далі те, чого в item
  уже немає.
- Якщо правка робить слово копією іншого в тому ж наборі — відмова, нічого не
  записується.

## Повторення

Набір, який ти пройшов, повертається за розкладом: **через день → 3 дні →
тиждень → 2 тижні → місяць**, далі кожен місяць — доки не спрацює ліміт
повторень. Пункт меню `🔁 Повторення`
показує те, чий день настав — найпростроченіші зверху. Нічого не стартує
саме: обираєш зі списку.

О **09:00** бот сам надсилає той самий список. Якщо повторювати нема чого —
мовчить.

Два обмеження на набір або глобально:

- **стеля** (`maxIntervalDays`) — далі інтервал не росте. Постав 7, і набір
  повертатиметься щотижня, доки не спрацює ліміт.
- **ліміт** (`maxRepetitions`) — стільки повторень після першого проходження,
  далі набір «на пенсії» й більше не пропонується. Типово **10**.

```jsonc
quiz_set_settings({
  quizSetId,                       // без нього — глобальні налаштування
  intervalsDays: [1, 3, 7, 14, 30],
  maxIntervalDays: 30,
  maxRepetitions: 10,
  shuffleOptions: true,
  shuffleQuestions: true,
  examMode: false,
})
```

Змінюються лише передані поля. Налаштування резолвляться: під набір →
глобальні → вбудовані. `quiz_get_settings` каже, звідки саме вони взялися
(`source`), бо записати для набору те, що прочитав, означає **відчепити його
від глобальних** назавжди — `inheritGlobal: true` чіпляє назад.

## Налаштування з бота

`⚙️ Налаштування` → **Загальні** або **Для набору** (через те саме дерево
папок). Екран показує, звідки взялися чинні значення, і дає їх змінити:

- **три пресети драбини** — Швидко `1·2·4·7·14`, Стандарт `1·3·7·14·30`,
  Повільно `1·3·7·21·60`. Обраний позначений `✓`. Пресет піднімає стелю, якщо
  вона нижча за його найдовший інтервал — інакше «Повільно» мовчки лишалося б
  «Стандартом».
- **стеля** і **максимум повторень** — кнопками `−`/`+`, по сходинці
  (`… 14 → 30 → 60 → 90 …`), бо крок в один день від 30 нічого не вартий.
- **перемішування варіантів** і **перемішування питань** — два окремі
  перемикачі.
- **режим екзамену** — перемикач.
- **скинути до глобальних** — прибирає власні налаштування набору, і він знову
  йде за глобальними. Доти набір їх лише успадковує: перша ж зміна відчіплює
  його.

Глобальні й набірні не течуть одне в одне: змінене для набору не зачіпає
глобальні, і навпаки.

## Порядок варіантів

`shuffleOptions` вирішує, чи показувати варіанти відповіді в тому порядку, у
якому їх написали, чи щоразу в новому. Перемішування засівається парою
«спроба + питання»: у межах однієї спроби екран можна перемальовувати скільки
завгодно — кнопка не поїде з-під пальця, — а наступна спроба того самого
питання дасть інший порядок.

Перемішується **показ**, не самі варіанти: у кнопці їде авторська позиція, тож
відповідь зараховується тій, на яку ти справді натиснув. Нумерація (для довгих
варіантів) іде за екраном, а не за авторським порядком.

## Порядок питань

`shuffleQuestions` — те саме для самих питань: чи йдуть вони в тому порядку, у
якому їх написали, чи щоразу в новому. Налаштування окремі, тому можна
перемішувати питання, лишивши варіанти на місці, і навпаки.

Порядок вибирається **один раз, коли спроба починається**, і зберігається
разом із нею. Тому:

- вихід із бота й `▶️ Продовжити навчання` повертають те саме питання, а не
  нове — як і рестарт процесу;
- статистика показує спробу в тому порядку, у якому ти її справді проходив;
- перемикач, натиснутий посеред спроби, її не перетасовує — він діє з
  наступної. Інакше «наступне питання» стрибало б посеред проходження.

Повторення (`🔁`) перемішується так само: беруться лише ті питання, чий день
настав, і вже вони йдуть у випадковому порядку.

Спроба, завершена без жодної відповіді, розклад не рухає — інакше два тапи
«почав → завершив» рахувалися б як повторення.

**Інтервал рахується від фактичного проходження.** Пропустив повторення на
місяць — наступні три дні йдуть від дня, коли справді пройшов, а не від дати,
коли мав. Прострочення нічого не накопичує.

Повторення — звичайна спроба, тому воно потрапляє в статистику як спроба. Там
кожну спробу можна відкрити й побачити, як ти відповідав на кожне питання.

## Режим екзамену

`examMode` прибирає будь-який фідбек під час проходження. Питання йдуть одне за
одним, і після відповіді не показується **нічого**: ні ✅/❌, ні правильний
варіант, ні пояснення, ні поточний рахунок. Рахунок — теж підказка: якщо він
видно, зрозуміло, чи зайшла попередня відповідь.

- `🤔 Не знаю` лишається, але тепер **не показує відповідь** — просто зараховує
  пропуск і йде далі. Інакше в екзамені була б кнопка «дай відповідь».
  Пропуск і далі не те саме, що помилка.
- екран відповіді зникає разом із `➡️ Далі`, тому екзамен — це один тап на
  питання замість двох.
- усе показується **в кінці**: на екрані завершення є `🔍 Розбір`, який
  відкриває спробу питання за питанням. Це єдине місце, де в екзамені видно
  відповіді. Кнопка є після будь-якої спроби, не лише екзаменаційної.
- у розборі до кожної **неправильної** відповіді додається правильна і
  пояснення (`💡`). Для правильних пояснення не дублюється — інакше довгий
  набір швидше впирався б у ліміт тексту й обрізав хвіст питань.

Рахунок, пропуски й розклад повторень працюють як завжди — екзамен це звичайна
повна спроба, тому вона рухає драбину (на відміну від тренувань).

На відміну від перемішування питань, `examMode` читається **на кожному екрані**,
а не фіксується на старті спроби: увімкнеш посеред проходження — решта питань
піде з фідбеком. Порядок при цьому не переписується, тому нічого не ламається.

## Помилки та слабкі теми

Два тренування поверх історії відповідей. Обидва беруться з меню й вибирають
набір через те саме дерево папок, що й статистика та налаштування.

**🔁 Повторити помилки** — питання, на які ти відповів неправильно й досі не
виправив. Питання зникає зі списку, щойно ти відповів на нього правильно —
байдуже де: у звичайній спробі, у повторенні чи в самому тренуванні.

**🧠 Слабкі теми** — усі питання тем, які ти стабільно провалюєш. Тема
вважається слабкою, коли на неї є **щонайменше 3 відповіді** й **менше ніж 70%**
з них правильні. Поріг на кількість потрібен, бо одна неправильна відповідь
робить тему «0%», і без нього тренування складалося б із шуму. Питання **без
теми** сюди не потрапляють: `(none)` — це не тема, а мішок. Слабкі теми йдуть
від найгіршої; за однакової точності перша та, яку ти відповідав частіше.

У тренування потрапляють і питання слабкої теми, яких ти ще не бачив, — тема
слабка через ту частину, яку ти вже проходив.

**Тренування не рухає розклад повторень.** Його можна проходити скільки
завгодно разів на день, тому інтервал від нього не росте — інакше п'ять
прогонів за вечір відсунули б картку на місяць на суто механічній практиці, а
`maxRepetitions` міг би відправити «на пенсію» те, чого ти так і не знаєш.
Розклад рухає лише `🔁 Повторення`. Відповіді при цьому зберігаються
нормально — саме тому виправлена помилка зникає зі списку.

Якщо тренувати нічого, екран так і каже, а не показує помилку.

Обидва списки — **у межах набору**. Раніше екран статистики показував теми й
кількість помилок з усіх наборів разом, хоч сам був відкритий на одному;
тепер і статистика, і тренування рахують лише той набір, який ти відкрив.

## Папки

Набори живуть у дереві папок: `Programming / SQL`,
`English / Vocabulary / By levels / A1`.

- Папка вкладається максимум **6 рівнів**; назва — до **60 символів**.
- Імена унікальні серед сусідів і порівнюються без урахування регістру, тому
  `Food` і `food` в одній папці співіснувати не можуть. Під різними батьками —
  можуть.
- Набір лежить рівно в одній папці або **ніде**: набори без папки показуються в
  корені. Набір може лежати на будь-якому рівні, не лише в листі.
- Папку можна видалити **лише порожньою** — і з підпапками, і з наборами
  всередині видалення відхиляється. Жодна операція з папками не видаляє набір.
- Лічильник біля папки в Telegram рахує **опубліковані** набори безпосередньо в
  ній **плюс її прямі підпапки** — щоб папка, чиї набори лежать глибше, не
  виглядала порожньою. Це сума прямих дітей, а не рекурсивний підрахунок: папка
  з однією порожньою підпапкою покаже `(1)`. `quiz_list_folders` рахує лише
  набори і додатково показує чернетки й архівні (`Scratch (0 sets, 1
  unpublished)`), бо саме вони блокують видалення, а в Telegram їх не видно.

Дерево створюється **тільки через Claude (MCP)**. Telegram дерево лише показує:
"📚 Мої набори" відкриває корінь, тап по `📁` спускається глибше, `« Назад`
повертає до батька. Екран показує 8 записів і гортається кнопками
`‹ Попередні` / `Наступні ›`.

### Шляхи, а не id

Усі folder-tools приймають шлях — масив назв, а не id:

```jsonc
// створити повний шлях; існуючі сегменти перевикористовуються
quiz_ensure_folder_path({ path: ["English", "Vocabulary", "By levels", "A1"] })
// → { folderId: "...", created: ["English", "Vocabulary", "By levels", "A1"] }

// вдруге — нічого не створює, повертає той самий id
quiz_ensure_folder_path({ path: ["English", "Vocabulary", "By levels", "A1"] })
// → { folderId: "...", created: [] }

// створити набір одразу в папці
quiz_create_set({
  title: "A1: базові слова",
  language: "en",
  folderPath: ["English", "Vocabulary", "By levels", "A1"],
})

// перекласти існуючий набір
quiz_move_set({ quizSetId: "...", folderPath: ["Programming", "SQL"] })

// повернути в корінь
quiz_move_set({ quizSetId: "..." })
```

`quiz_ensure_folder_path` ідемпотентний, тому повтор після невдалої відповіді
безпечний. `quiz_rename_folder` і `quiz_delete_folder` шлях **не створюють** —
на неіснуючому шляху вони повертають помилку, а не мовчки роблять папку.


## Експлуатація

| Команда | Призначення |
| --- | --- |
| `bun run dev` | запустити бота локально з hot reload |
| `bun run start` | запустити зібраного бота |
| `bun run api` | підняти API, без якого бот не працює |
| `bun run status` | health-звіт: скільки наборів, спроб і питань |
| `bun run <entrypoint> --check` | перевірити конфігурацію і вийти (не відкриває database) |
| `bun run db:up` / `db:down` | підняти або зупинити локальний Postgres |
| `bun run api` | API разом із MCP (див. «Віддалений доступ до MCP») |

### Backup

Quiz data живе в Postgres, тому backup робить `pg_dump`, а не скрипт у репозиторії:

```bash
docker exec recall-postgres pg_dump -U recall -d recall -Fc > quiz.dump
docker exec -i recall-postgres pg_restore -U recall -d recall --clean < quiz.dump
```

Окремо варто зберігати `OAUTH_DATABASE_PATH` — це звичайний SQLite файл із
client credentials. Старий `data/quiz.before-postgres-*.sqlite` — read-only
escape hatch на випадок, якщо в перенесених даних знайдеться проблема.

### Graceful shutdown

На `SIGINT`/`SIGTERM` бот спершу зупиняє polling і лише потім закриває
connection pool — інакше сигнал під час відповіді розірвав би connection посеред
транзакції. Повторний
сигнал не запускає другий teardown, а помилка в одному кроці не блокує решту.

### Logs

Structured JSON, один рядок на запис, у **stderr** (stdout зайнятий MCP
протоколом). Поля з іменами, схожими на credentials, редагуються; довгі рядки
обрізаються, тому тексти книг і питань не потрапляють у logs; raw Telegram
updates не логуються взагалі. `--debug` вмикає debug-рівень і для бота, і для
MCP server.

Логуються всі змістовні requests:

| Запис | Коли | Ключові поля |
| --- | --- | --- |
| `telegram update` | кожен оброблений update | `update`, `action`, `telegramUserId`, `durationMs`, `outcome` |
| `telegram handler failed` | handler кинув помилку | ті самі поля плюс `error` (name і message, без stack) |
| `rejected an update from an unknown user` | update не від `ALLOWED_TELEGRAM_USER_ID` | `telegramUserId`, `update` |
| `could not decode callback data` | застаріла або зіпсована callback payload | `telegramUserId`, `action`, `dataLength` |
| `mcp tool` | кожен виклик MCP tool | `tool`, `durationMs`, `outcome` плюс `quizSetId`, `questionCount`, `folderPath` |
| `mcp tool failed` | tool завершився помилкою | ті самі поля плюс `error` |
| `database ready` | старт процесу | `driver` |
| `shutting down`, `shutdown complete` | teardown | `reason`, `tasks` |

Записи описують **що** сталося, а не **зміст**: замість тексту питання — його
id, замість вибраних варіантів — їх кількість, замість тіла повідомлення — його
довжина.

## Безпека та приватність

- не комітьте Telegram tokens, Claude credentials, книги або приватні матеріали;
- до реалізації allowlist не публікуйте bot username для сторонніх користувачів;
- AI-generated quiz content має вважатися недовіреним input і проходити schema та business validation;
- remote MCP не входить у MVP; перша версія використовуватиме локальний `stdio` transport.
