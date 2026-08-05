# Personal Learning Quiz Bot

Персональний Telegram-бот для активного навчання: Claude перетворює книгу, PDF, конспект або транскрипт на структурований набір запитань і передає його через MCP, а бот проводить тести, пояснює помилки та зберігає прогрес.

> **Статус:** Phases 1-3 виконані: domain models, SQLite persistence, application use cases і робочий Telegram-бот. MCP server (створення наборів через Claude) ще очікує реалізації, тому набори поки додаються програмно.

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
- повторення неправильних відповідей;
- adaptive practice та spaced repetition;
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
- `bun:sqlite` + [Drizzle ORM](https://orm.drizzle.team) — локальна database, schema
  та versioned migrations;
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
| `APP_TIMEZONE` | IANA time zone для streaks і spaced repetition |

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
звичайний сценарій «додати значення в `QuestionType` / `ReviewItemState`» —
змушує `drizzle-kit generate` видати 12-step rebuild: `PRAGMA foreign_keys=OFF`,
`CREATE TABLE __new_<name>`, `INSERT ... SELECT`, `DROP TABLE <name>`,
`ALTER TABLE __new_<name> RENAME TO <name>`, `PRAGMA foreign_keys=ON`.

Через Drizzle migrator такий файл застосовувати **не можна**. Drizzle виконує всі
migrations в одній транзакції, а `PRAGMA foreign_keys` всередині транзакції —
тихий no-op. Foreign keys залишаються включеними на `DROP TABLE`, кожен
`ON DELETE CASCADE` спрацьовує, і весь дочірній graph зникає: разом із
`quiz_sets` пішли б `questions`, `question_options`, `quiz_attempts`,
`question_responses` та `review_items`. Migration завершилась би з кодом `0`.

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
5. **MCP authoring** — локальний server та tools для Claude.
6. **Adaptive practice** — mistakes queue, weak topics і spaced repetition.
7. **Reliability** — lifecycle, privacy-safe logging, backup/restore і local deployment.

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
  domain/
    quiz-set/       QuizSet, Question and validation model
    quiz-attempt/   QuizAttempt, answer evaluation and scoring model
    review/         ReviewItem model
    branded-id.ts
  application/
    use-case.ts    shared Command and UseCase contracts
    ports/         Clock, IdGenerator and Transaction contracts
      repositories/ quiz set, quiz attempt and review repository contracts
    use-cases/
      quiz-sets/    create, update, add questions, publish, archive
      attempts/     start, pause, resume, answer, finish
      statistics/   per-attempt, per-set, per-topic and improvement figures
  adapters/
    persistence/
      sqlite/
        database.ts connection lifecycle and SQLite pragmas
        migrator.ts guarded Drizzle migration runner
        schema.ts   Drizzle SQLite schema
        sqlite-transaction.ts Transaction port over bun:sqlite
        repositories/ repository implementations and row mappers
  infrastructure/
    config/
      env.ts       validated startup configuration
  adapters/
    telegram/
      bot.ts       Telegraf wiring and callback routing
      middleware/  allowlist and error mapping
      handlers/    thin handlers, one use case each
      presenters/  screen text and inline keyboards
      callbacks/   callback payload encoding
  composition/
    create-application.ts  manual dependency injection root
  entrypoints/
    telegram.ts    starts the bot; --check validates configuration and exits
drizzle/
  0000_initial-schema.sql
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

## Безпека та приватність

- не комітьте Telegram tokens, Claude credentials, книги або приватні матеріали;
- до реалізації allowlist не публікуйте bot username для сторонніх користувачів;
- AI-generated quiz content має вважатися недовіреним input і проходити schema та business validation;
- remote MCP не входить у MVP; перша версія використовуватиме локальний `stdio` transport.
