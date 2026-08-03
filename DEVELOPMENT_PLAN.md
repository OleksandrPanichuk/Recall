# Personal Learning Quiz Bot — development plan

## Мета

Покроково побудувати персональний learning quiz bot на очищеній Bun/TypeScript foundation, у якому Claude створює навчальні набори через MCP, а Telegram-бот автономно проводить тести, перевіряє відповіді та показує прогрес.

## Принцип виконання

Кожен work package нижче має реалізовуватися окремою task-гілкою циклу:

```text
implementer -> focused verification -> independent review
     ^                                      |
     |                                      v
     +--------- fix <- findings <- re-review
```

Залежний work package не починається, поки попередній не пройшов review gate. Перед початком кожної фази агент створює детальний task plan із точними файлами, тестами та командами перевірки.

`ARCHITECTURE.md` є binding source of truth для dependency direction, pattern selection, layer ownership і target folder structure. Кожен implementation plan та review має перевіряти відповідність цим правилам.

## Обов'язкові глобальні обмеження

- Runtime: Bun.
- Language: strict TypeScript.
- Architecture: Ports and Adapters із dependency direction `adapters -> application -> domain`.
- Telegram framework: Telegraf.
- Local database: `bun:sqlite`.
- MCP і Telegram є adapters над спільною application layer.
- AI-generated content завжди проходить schema та business validation.
- MVP підтримує лише одного Telegram-користувача через allowlist.
- Проходження опублікованих тестів не залежить від AI API.
- Реальні tokens, credentials і книги не зберігаються в Git.
- Нова поведінка та bug fixes реалізуються через TDD.

## Phase 0 — Repository foundation

### 0.1 Ініціалізувати контроль версій

Результат:

- Git repository з початковим baseline commit;
- feature branch для розробки;
- `.gitignore` для `.env`, SQLite database/WAL files, logs, build output і agent workflow scratch files;
- підтвердження, що жоден secret не потрапив у baseline.

Gate: `git status` показує чисту feature branch; tracked files не містять bot token.

### 0.2 Зафіксувати команди якості

Додати й перевірити scripts для:

- `bun test`;
- `bun run typecheck`;
- `bun run build`;
- форматування або lint check без автоматичного переписування під час verification.

Gate: усі baseline-команди запускаються; відомі початкові failures задокументовані.

### 0.3 Налаштувати конфігурацію середовища

Додати `.env.example` із:

- `TELEGRAM_BOT_KEY`;
- `ALLOWED_TELEGRAM_USER_ID`;
- `DATABASE_PATH`;
- `APP_TIMEZONE`.

Gate: application startup відмовляється запускатися з некоректною конфігурацією та не виводить secrets у logs.

## Phase 1 — Domain model and persistence

### 1.1 Визначити domain types

Створити моделі:

- `QuizSet` зі статусами `draft`, `published`, `archived`;
- `Question` із типами `single_choice`, `multiple_choice`, `true_false`;
- `QuizAttempt`;
- `QuestionResponse`;
- `ReviewItem` для повторення помилок.

Gate: domain types не імпортують Telegraf, MCP або SQLite.

### 1.2 Додати SQLite migrations

Створити versioned schema та migration runner для quiz sets, questions, options, attempts, responses і review queue.

Gate:

- migration створює нову database;
- повторний запуск idempotent;
- foreign keys увімкнені;
- migration tests працюють на temporary database.

### 1.3 Реалізувати repositories

Repositories мають підтримувати:

- створення й оновлення draft set;
- batch insert питань у transaction;
- list/get/publish/archive set;
- створення, продовження й завершення attempt;
- запис відповіді без дублювання;
- читання статистики та review queue.

Gate: repository integration tests покривають happy path, constraints, rollback і not-found cases.

## Phase 2 — Application services

### 2.1 Quiz set management

Створити application service для create/update/add questions/publish/archive.

Business rules:

- published set має містити хоча б одне валідне питання;
- `single_choice` має рівно одну правильну option;
- `multiple_choice` має одну або більше правильних options;
- `true_false` має рівно два допустимі варіанти;
- published content не змінюється напряму;
- repeated MCP calls не створюють випадкові дублікати.

Gate: unit tests доводять кожне правило й transactional batch behavior.

### 2.2 Quiz attempt engine

Реалізувати start/resume/answer/next/finish без Telegram dependencies.

Gate:

- неможливо відповісти на питання поза active attempt;
- повторний callback не зараховує відповідь двічі;
- scoring детермінований;
- pause/resume переживає process restart.

### 2.3 Statistics service

Розрахувати:

- score і percentage по attempt;
- accuracy по set;
- accuracy по topic;
- incorrect questions;
- improvement між першою та останньою спробою.

Gate: calculation tests включають empty history, repeated attempts і mixed topics.

## Phase 3 — Personal Telegram interface

### 3.1 Security middleware

Додати allowlist middleware перед command, message та callback handlers.

Gate: неавторизований user не може читати набори, створювати attempts або запускати application services.

### 3.2 Navigation shell

Додати Telegram handlers для:

- `/start` і головне меню;
- `Мої набори`;
- `Продовжити навчання`;
- `Повторити помилки`;
- `Слабкі теми`;
- `Статистика`;
- `Налаштування`.

Gate: handler tests перевіряють routing і callback payload validation.

### 3.3 Quiz flow

Реалізувати вибір набору, start/resume, inline answers, feedback, next question і final result.

Gate:

- callback payload містить стабільні IDs, а не правильну відповідь;
- stale і duplicated callbacks обробляються без подвійного score;
- пояснення показується лише після відповіді;
- progress зберігається після restart.

### 3.4 Result and history screens

Додати summary, history, topic breakdown і список помилок.

Gate: Telegram presentation не дублює calculation logic зі statistics service.

## Phase 4 — MCP authoring interface

### 4.1 Підняти локальний MCP server

Використати stdio transport для Claude Desktop/Claude Code. MCP entrypoint має використовувати спільні application services.

Gate: server запускається окремою Bun command і відповідає на MCP initialize/list tools.

### 4.2 Реалізувати write tools

Додати:

- `quiz.create_set`;
- `quiz.add_questions`;
- `quiz.update_set`;
- `quiz.publish_set`;
- `quiz.archive_set`.

Gate:

- кожен input проходить schema validation;
- batch size має верхню межу;
- invalid batch повністю rollback-иться;
- tool response повертає stable semantic IDs і короткий summary.

### 4.3 Реалізувати read tools

Додати:

- `quiz.get_set`;
- `quiz.list_sets`;
- summary validation перед publish.

Gate: Claude може створити draft batches, перечитати набір і опублікувати його без прямого доступу до database.

### 4.4 Перевірити end-to-end authoring

Сценарій:

1. Дати Claude тестовий PDF або fixture text.
2. Створити draft через MCP.
3. Додати щонайменше дві batches питань.
4. Перечитати й опублікувати набір.
5. Пройти набір у Telegram.

Gate: жоден ручний SQL/database edit не потрібен.

## Phase 5 — Review mistakes and adaptive practice

### 5.1 Repeat mistakes

Після неправильної відповіді додавати question у review queue; правильне повторення оновлює його стан.

Gate: один question не створює необмежену кількість duplicate review items.

### 5.2 Weak-topic session

Формувати сесію з тем із найнижчою accuracy та достатньою кількістю відповідей.

Gate: selection logic детермінована й покрита tests із tie cases.

### 5.3 Простий spaced repetition

Додати rule-based intervals `1`, `3`, `7`, `21` days і user rating `hard`, `good`, `easy`.

Gate: timezone-safe scheduling і boundary tests навколо дати/часу.

FSRS або SM-2 залишити окремою майбутньою фазою після накопичення реальних usage data.

## Phase 6 — Reliability and operations

### 6.1 Graceful lifecycle

Додати graceful shutdown, closing database handles і Telegram stop signals.

Gate: SIGINT/SIGTERM не залишають незавершених writes.

### 6.2 Logging and privacy

Додати structured logs без повних книг, correct answers, credentials або raw Telegram updates за замовчуванням.

Gate: privacy-focused review не знаходить secrets чи надлишковий content у logs.

### 6.3 Backup and restore

Додати документоване резервне копіювання SQLite та перевірений restore flow.

Gate: automated smoke test відновлює quiz sets і attempt history із backup fixture.

### 6.4 Local deployment

Налаштувати стабільний local process launch на macOS і health/status command.

Gate: бот переживає restart і продовжує active attempt.

## Phase 7 — Optional AI-dependent features

Виконувати лише після стабільного MVP:

- оцінювання `short_answer` та `open_answer`;
- додаткові пояснення на вимогу;
- голосові відповіді й transcription;
- link-first import статей і transcript sources;
- remote MCP deployment;
- web dashboard;
- shareable quiz sets і multi-user roles.

Кожна функція має окремо оцінити privacy, API cost і необхідність AI. Не використовувати AI там, де deterministic code достатній.

## Release gates

### MVP Alpha

- Phases 0–4 завершені;
- локальний Claude створює й публікує набір через MCP;
- персональний Telegram user проходить його після restart;
- усі tests, typecheck і build проходять;
- final whole-branch review не має critical/important findings.

### MVP Beta

- Phase 5 завершена;
- повторення помилок і weak-topic sessions працюють на реальній історії;
- backup/restore перевірений;
- мінімум один повний dogfooding цикл із реальною книгою.

### Stable Personal Release

- Phase 6 завершена;
- задокументовано setup Claude MCP, Telegram і local process;
- secrets та privacy review пройдені;
- відновлення після restart і backup перевірене end-to-end.
