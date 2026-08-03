# Personal Learning Quiz Bot

Персональний Telegram-бот для активного навчання: Claude перетворює книгу, PDF, конспект або транскрипт на структурований набір запитань і передає його через MCP, а бот проводить тести, пояснює помилки та зберігає прогрес.

> **Статус:** планування та clean foundation. Застарілий publish-bot видалено; quiz domain, SQLite persistence, Telegram adapter, MCP server, статистика та spaced repetition ще не реалізовані.

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
- `bun:sqlite` — запланована локальна database;
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
змінних і причини — значення не логуються, тому токен не потрапляє в logs.

Створити або оновити schema локальної database:

```bash
bun run migrate
# applied 1 (initial-schema)
```

Команда читає `DATABASE_PATH`, застосовує лише ще не застосовані migrations і
друкує `database is up to date`, якщо роботи немає, тому її безпечно запускати
повторно. Бот міграції не виконує сам — schema змінюється лише цією
командою. Якщо database вже відкрита іншим процесом, open чекає до 5 секунд,
тому команда спочатку друкує рядок про те, що саме відкриває.

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
| `bun run lint` | Перевірити код правилами Biome linter |
| `bun run lint:fix` | Автоматично виправити safe lint findings |
| `bun run format:check` | Перевірити форматування без зміни файлів |
| `bun run format` | Відформатувати підтримувані файли через Biome |
| `bun run check` | Одночасно перевірити lint, formatting та imports |
| `bun run check:fix` | Застосувати safe Biome fixes, formatting та import sorting |
| `bun run typecheck` | Перевірити TypeScript без генерації output |
| `bun run migrate` | Застосувати SQLite migrations до `DATABASE_PATH` |
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
2. **Domain and persistence** — quiz models, SQLite migrations і repositories.
3. **Application services** — authoring, attempts, scoring і statistics.
4. **Telegram interface** — allowlist, меню, quiz flow і results.
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
  application/
    use-case.ts    shared Command and UseCase contracts
    ports/         Clock, IdGenerator and Transaction contracts
  infrastructure/
    config/
      env.ts       validated startup configuration
  entrypoints/
    telegram.ts    temporary entrypoint: configuration check only
tests/
  e2e/
    startup.test.ts
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

Target structure не створюється наперед порожніми directories. Domain,
application і adapter files додаватимуться поступово за правилами
[ARCHITECTURE.md](ARCHITECTURE.md).

## Безпека та приватність

- не комітьте Telegram tokens, Claude credentials, книги або приватні матеріали;
- до реалізації allowlist не публікуйте bot username для сторонніх користувачів;
- AI-generated quiz content має вважатися недовіреним input і проходити schema та business validation;
- remote MCP не входить у MVP; перша версія використовуватиме локальний `stdio` transport.
