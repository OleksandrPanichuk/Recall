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

SQLite не вміє змінювати `CHECK`, тому будь-яка зміна enum-списку — тобто
звичайний сценарій «додати значення в `QuestionType` / `QuizAttemptMode`» —
змушує `drizzle-kit generate` видати 12-step rebuild: `PRAGMA foreign_keys=OFF`,
`CREATE TABLE __new_<name>`, `INSERT ... SELECT`, `DROP TABLE <name>`,
`ALTER TABLE __new_<name> RENAME TO <name>`, `PRAGMA foreign_keys=ON`.

Через Drizzle migrator такий файл застосовувати **не можна**. Drizzle виконує всі
migrations в одній транзакції, а `PRAGMA foreign_keys` всередині транзакції —
тихий no-op. Foreign keys залишаються включеними на `DROP TABLE`, кожен
`ON DELETE CASCADE` спрацьовує, і весь дочірній graph зникає: разом із
`quiz_sets` пішли б `questions`, `question_options`, `quiz_attempts`
та `question_responses`. Migration завершилась би з кодом `0`.

Тому `applyMigrations` відмовляється застосовувати pending migration, у SQL якої
є `PRAGMA foreign_keys` або таблиця з префіксом `__new_`, і кидає
`UnsafeMigrationError` з назвою файлу. Нічого не застосовується.

Ручна процедура для такої migration:

1. Переконатися, що всі попередні **безпечні** migrations уже застосовані, а
   rebuild migration є наступною pending migration. Створити консистентний
   backup через SQLite backup API (не копіювати лише database-файл):

   ```bash
   backup_path="${DATABASE_PATH}.before-rebuild.sqlite"
   sqlite3 "$DATABASE_PATH" ".backup '$backup_path'"
   ```
2. Записати кількість рows у кожній дочірній таблиці **до** зміни.
3. Дописати `) STRICT;` до кожного `CREATE TABLE` у згенерованому файлі,
   включно з `__new_*`.
4. Відкрити **інтерактивну** SQLite session (`sqlite3 "$DATABASE_PATH"`) і
   виконати наведений нижче порядок в одному connection. Не закривайте session
   після `PRAGMA foreign_key_check`: transaction має залишатися відкритою до
   рішення `ROLLBACK` або `COMMIT`.

   ```sql
   PRAGMA foreign_keys=OFF;
   BEGIN IMMEDIATE;
   -- reviewed statements зі згенерованого rebuild .sql file;
   -- вилучити його PRAGMA foreign_keys=OFF/ON рядки
   PRAGMA foreign_key_check;
   ```

   `PRAGMA foreign_keys=OFF` має стояти **до** `BEGIN IMMEDIATE`, інакше він
   буде no-op. Перевірте результат `PRAGMA foreign_key_check` **до** commit:

   - якщо він повернув хоча б один row, виконайте `ROLLBACK;`, не додавайте
     migration до ledger і відновіть database з backup перед повторною спробою;
   - якщо він не повернув rows, не виходячи з тієї самої transaction, вставте
     ledger record і лише потім commit:

     ```sql
     -- SHA-256 exact reviewed contents of drizzle/<tag>.sql:
     -- shasum -a 256 "drizzle/<tag>.sql"
     INSERT INTO __drizzle_migrations (hash, created_at)
     VALUES ('<SHA-256 of reviewed drizzle/<tag>.sql>', <when from drizzle/meta/_journal.json>);
     COMMIT;
     ```

   **Ніколи не запускайте `bun run migrate` між ручним rebuild і цим ledger
   insert.** До ledger record migrator вважатиме migration pending і навмисно
   відмовиться її застосовувати.
5. Після commit, у тій самій SQLite session, знову увімкніть і перевірте foreign
   keys:

   ```sql
   PRAGMA foreign_keys=ON;
   PRAGMA foreign_keys; -- must return 1
   PRAGMA foreign_key_check; -- must return no rows
   ```

6. Порівняти кількість rows у дочірніх таблицях із кроком 2. Лише після цього
   `bun run migrate` має повідомити `database is up to date`.

Перевірити clean baseline:

```bash
bun run verify
```

Quiz runtime behavior ще не реалізовано. `src/entrypoints/telegram.ts`
тимчасово лише валідує конфігурацію, щоб quality, typecheck, test і build
scripts працювали до першого quiz-bot vertical slice:

```bash
bun run dev
# Configuration is valid. database=./data/quiz.sqlite timezone=Europe/Kyiv
```

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
| `bun run build` | Зібрати `src/entrypoints/telegram.ts` у `dist/` |
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
