# Personal Learning Quiz Bot

Персональний Telegram-бот для активного навчання: Claude перетворює книгу, PDF, конспект або транскрипт на структурований набір запитань і передає його через MCP, а бот проводить тести, пояснює помилки та зберігає прогрес.

> **Статус:** Stable Personal Release. Phases 1-6 виконані: domain models, SQLite persistence, application use cases, Telegram-бот, MCP server, adaptive practice і operations (graceful shutdown, privacy-safe logs, backup/restore, health command).

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
             SQLite database
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
- `bun:sqlite` + [Drizzle ORM](https://orm.drizzle.team) — локальна database, schema,
  versioned migrations і всі repository-запити;
- Model Context Protocol — запланована інтеграція з Claude Desktop/Claude Code.

## Поточна локальна foundation

### Передумови

- Bun.

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
| `DATABASE_PATH` | Шлях до локального `bun:sqlite` файлу |
| `APP_TIMEZONE` | IANA time zone для дат у звітах |

Усі чотири змінні обов'язкові. `src/infrastructure/config/env.ts` валідує їх на
старті через zod і, якщо конфігурація некоректна, виводить список усіх проблем
одразу та завершує процес із кодом `1`. У повідомленні про помилку є лише назви
змінних і причини — секретні значення не логуються, тому токен не потрапляє в
logs. Водночас це не означає, що приховуються всі значення: startup друкує
нешкідливі `DATABASE_PATH` і `APP_TIMEZONE`, а migration command друкує
`DATABASE_PATH`, щоб оператор бачив, з яким файлом працює процес.

Створити або оновити database за шляхом `DATABASE_PATH`:

```bash
bun run migrate
```

Команда друкує шлях перед відкриттям файлу, застосовує pending migrations із
`drizzle/` і виводить список застосованих версій або `database is up to date`.
Повторний запуск нічого не змінює. Секретні environment variables у вивід не
потрапляють; не-secret database path друкується навмисно. Перед закриттям
connection команда **намагається** виконати `PRAGMA wal_checkpoint(TRUNCATE)` і
повернути journal mode у `delete`, але це best-effort cleanup: за наявності
іншого connection дані можуть залишитися в `-wal`. Ніколи не вважайте просту
копію `quiz.sqlite` повним backup. Для консистентного backup використовуйте
SQLite backup API через CLI:

```bash
backup_path="${DATABASE_PATH}.backup.sqlite"
sqlite3 "$DATABASE_PATH" ".backup '$backup_path'"
```

Schema описана в `src/adapters/persistence/sqlite/schema.ts`. Після її зміни
потрібно згенерувати нову migration:

```bash
bun run db:generate
```

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
| `bun run dev` | Запустити watch mode для майбутнього Telegram entrypoint |
| `bun run migrate` | Застосувати pending SQLite migrations до `DATABASE_PATH` |
| `bun run db:generate` | Згенерувати migration зі змін у Drizzle schema |
| `bun run lint` | Перевірити код правилами Biome linter |
| `bun run lint:fix` | Автоматично виправити safe lint findings |
| `bun run format:check` | Перевірити форматування без зміни файлів |
| `bun run format` | Відформатувати підтримувані файли через Biome |
| `bun run check` | Одночасно перевірити lint, formatting та imports |
| `bun run check:fix` | Застосувати safe Biome fixes, formatting та import sorting |
| `bun run typecheck` | Перевірити TypeScript без генерації output |
| `bun run mcp:http` | Підняти MCP через HTTP для віддаленого доступу |
| `bun run build` | Зібрати всі три entrypoints у `dist/` |
| `bun run start` | Запустити попередньо зібраний `dist/telegram.js` |
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
2. **Domain and persistence** — domain models, SQLite schema, migrations та repositories (готово).
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

```text
src/
  shared/
    utils/          layer-free date, text and duplicate primitives
  domain/
    quiz-set/       QuizSet, Question and validation model
    quiz-attempt/   QuizAttempt, answer evaluation and scoring model
    folder/         Folder aggregate, naming and placement rules
    branded-id.ts
  application/
    use-case.ts    shared Command and UseCase contracts
    ports/         Clock, IdGenerator and Transaction contracts
      repositories/ quiz set, quiz attempt and folder repository contracts
    use-cases/
      quiz-sets/    create, update, add questions, publish, archive
      attempts/     start, pause, resume, answer, finish
      statistics/   per-attempt, per-set, per-topic and improvement figures
      folders/      create, rename, move, delete, ensure path, browse
  adapters/
    persistence/
      sqlite/
        database.ts connection lifecycle and SQLite pragmas
        migrator.ts guarded Drizzle migration runner
        schema.ts   Drizzle SQLite schema
        sqlite-transaction.ts Transaction port over bun:sqlite
        repositories/ Drizzle query builders and row mappers
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
    telegram/
      bot.ts       Telegraf wiring and callback routing
      middleware/  error mapping, request logging and allowlist
      handlers/    thin handlers, one use case each
      presenters/  screen text, inline keyboards and error text
      callbacks/   callback payload types and encoding
      utils/       privacy-safe description of an update
    mcp/
      server.ts    MCP server construction and tool registration
      tools/       one registrar per MCP tool
      schemas/     zod input schemas
      presenters/  tool result and error text
      utils/       per-call tool logging
  composition/
    create-application.ts  manual dependency injection root
  entrypoints/
    telegram.ts    starts the bot; --check validates configuration and exits
    mcp.ts         stdio MCP server for Claude
drizzle/
  0000_initial-schema.sql
  0001_drop-review-items.sql
  0002_folders.sql
  meta/
    _journal.json
scripts/
  migrate.ts       migration command
tests/
  e2e/
    startup.test.ts
  fixtures/        aggregate builders shared by the integration tests
  integration/
    sqlite/        schema, migration and repository integration tests
skills/
  run-reviewed-development/
.env.example
DESCRIPTION.md
ARCHITECTURE.md
DEVELOPMENT_PLAN.md
WORKFLOW.md
AGENTS.md
CLAUDE.md
```

Target structure не створюється наперед порожніми directories. Application use
cases і transport adapters додаватимуться поступово за правилами
[ARCHITECTURE.md](ARCHITECTURE.md).

## Створення наборів через Claude (MCP)

MCP server працює локально через stdio і використовує ті самі application
services, що й бот, тому Claude ніколи не торкається SQL напряму.

Запуск вручну:

```bash
bun run mcp
```

Підключення до Claude Code:

```bash
claude mcp add recall-quiz --scope user \
  --env TELEGRAM_BOT_KEY=... \
  --env ALLOWED_TELEGRAM_USER_ID=... \
  --env DATABASE_PATH=/absolute/path/to/quiz.sqlite \
  --env APP_TIMEZONE=Europe/Kyiv \
  -- bun run /absolute/path/to/repo/src/entrypoints/mcp.ts
```

Для Claude Desktop додайте той самий command у `claude_desktop_config.json`
(`mcpServers.recall-quiz`) з абсолютними шляхами та тими ж чотирма змінними.

Доступні tools:

| Tool | Призначення |
| --- | --- |
| `quiz_create_set` | створити draft і отримати його id |
| `quiz_add_questions` | додати batch питань атомарно; повторний ідентичний batch — no-op |
| `quiz_update_set` | змінити metadata draft-набору |
| `quiz_get_set` | перечитати набір із позначеними правильними варіантами |
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

`bun run mcp` говорить через stdio — його запускає сам клієнт на цій машині.
`bun run mcp:http` піднімає **той самий** сервер, ті самі 17 tools і ту саму
базу, але через HTTP, щоб до нього дійшов Codex чи Claude Code з іншої машини.

```bash
openssl rand -hex 32          # токен, мінімум 32 символи
bun run mcp:http --check      # перевірити конфіг і вийти
bun run mcp:http
```

Змінні: `MCP_HTTP_TOKEN` (обов'язково), `MCP_HTTP_HOST` (типово `127.0.0.1`),
`MCP_HTTP_PORT` (типово `8765`), `MCP_HTTP_ALLOWED_HOST` (хост тунелю).

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
cloudflared tunnel --url http://127.0.0.1:8765
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

Сесії немає: кожен запит обробляється сам собою, бо всі 16 tools —
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
| `bun run status` | health-звіт: скільки наборів, спроб і питань |
| `bun run <entrypoint> --check` | перевірити конфігурацію і вийти (не відкриває database) |
| `bun run backup [файл]` | консистентний backup через `VACUUM INTO` |
| `bun run restore <файл>` | відновити з backup |
| `bun run mcp:http` | віддалений MCP через HTTP (див. «Віддалений доступ до MCP») |

### Backup

`bun run backup` використовує `VACUUM INTO` — власний механізм SQLite для
консистентної копії працюючої database. Результат — один файл без `-wal`
сайдкара. **Не копіюйте `quiz.sqlite` вручну:** найновіші writes можуть ще
лежати у WAL.

```bash
bun run backup                       # quiz.sqlite.2026-08-05T....backup.sqlite
bun run backup ~/backups/quiz.sqlite # або явний шлях
```

`bun run restore <файл>` спершу перевіряє, що файл — справжній Recall backup
(усі таблиці + migration ledger), і лише потім замінює database. Поточний файл
не перезаписується, а відсувається вбік із timestamp.

### Graceful shutdown

На `SIGINT`/`SIGTERM` бот спершу зупиняє polling і лише потім закриває database
— інакше сигнал під час відповіді закрив би handle посеред транзакції. Повторний
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
| `database ready` | старт процесу | `path`, `migrationCount`, `appliedMigrations` |
| `shutting down`, `shutdown complete` | teardown | `reason`, `tasks` |

Записи описують **що** сталося, а не **зміст**: замість тексту питання — його
id, замість вибраних варіантів — їх кількість, замість тіла повідомлення — його
довжина.

## Безпека та приватність

- не комітьте Telegram tokens, Claude credentials, книги або приватні матеріали;
- до реалізації allowlist не публікуйте bot username для сторонніх користувачів;
- AI-generated quiz content має вважатися недовіреним input і проходити schema та business validation;
- remote MCP не входить у MVP; перша версія використовуватиме локальний `stdio` transport.
