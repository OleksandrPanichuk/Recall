# Agent development workflow

## Мета

Цей workflow дозволяє однаково організувати розробку в Codex і Claude Code:

```text
written task
     |
     v
implementer agent
     |
     v
focused tests + implementation report
     |
     v
independent read-only reviewer
     |
     +-- no findings ----------------------+
     |                                      |
     +-- findings -> implementer fixes      |
                        |                   |
                        v                   |
                  scoped re-review --------+

                                      next task / final review
```

Головна сесія є coordinator-ом. Вона керує plan і evidence, але не реалізує task і не виконує незалежне review сама.

## Встановлені reusable skills

Глобально встановлені skills із `obra/superpowers`:

- `writing-plans`;
- `executing-plans`;
- `test-driven-development`;
- `requesting-code-review`;
- `subagent-driven-development`;
- `verification-before-completion`;
- `using-git-worktrees`;
- `finishing-a-development-branch`.

Проєкт також містить власний cross-platform skill:

- `run-reviewed-development` — повний implement-review-fix-re-review orchestration loop.

Source skill знаходиться в `skills/run-reviewed-development`.

## Перед початком розробки

Workflow потребує Git diff і commit boundaries. Поки цей каталог не є Git repository, можна планувати й редагувати документацію, але не можна запускати незалежний implementation/review loop.

Перший development session має:

1. перевірити repository files на secrets;
2. створити `.gitignore`;
3. ініціалізувати Git;
4. зробити baseline commit;
5. створити feature branch або worktree;
6. перевірити baseline commands.

## Planning session

`DEVELOPMENT_PLAN.md` є roadmap. Перед реалізацією конкретного work package потрібно створити точний implementation plan із файлами, interfaces, acceptance criteria, tests і verification commands. План має явно враховувати dependency rules, pattern boundaries і target folder ownership з `ARCHITECTURE.md`.

Приклад prompt, однаковий для Codex і Claude:

```text
Use the writing-plans skill.
Create an implementation plan for Phase 1.1 from DEVELOPMENT_PLAN.md.
Read DESCRIPTION.md, ARCHITECTURE.md, AGENTS.md, and the existing source first.
Do not implement anything yet.
```

Після plan review цей файл стає єдиним джерелом вимог для execution loop.

## Execution session

Приклад prompt:

```text
Use $run-reviewed-development to execute <path-to-plan>.
Keep the root session as coordinator.
Use a fresh implementer for each task and an independent read-only reviewer.
Fix all critical and important findings and independently re-review every fix.
Continue until the plan is complete or the workflow reaches a real blocker.
```

Claude Code може використовувати ту саму інструкцію без `$`, якщо UI не підтримує явний skill mention:

```text
Use the run-reviewed-development skill to execute <path-to-plan>.
```

## Task gate

Кожен task проходить такі стани:

1. `planned`;
2. `implementing`;
3. `focused verification passed`;
4. `in review`;
5. `fixing findings`, якщо потрібно;
6. `fix re-review`, якщо були зміни;
7. `approved`;
8. `complete`.

Task не може перейти в `complete`, якщо:

- specification verdict негативний;
- існує невиправлений critical/important finding;
- fix не пройшов scoped re-review;
- focused verification не має свіжого command output;
- diff містить незрозумілі або не пов'язані з task зміни.

## Review contract

Reviewer отримує:

- task brief;
- binding project constraints;
- applicable dependency and ownership rules from `ARCHITECTURE.md`;
- exact diff range;
- implementation report із test evidence.

Reviewer не отримує reasoning history implementer-а і не змінює файли.

Reviewer повертає:

- verdict щодо відповідності specification;
- verdict щодо відповідності `ARCHITECTURE.md`, включно з dependency direction і layer ownership;
- actionable findings із severity, file і line evidence;
- verdict щодо correctness, security, maintainability і test quality;
- material test gaps;
- `No findings`, якщо дефектів немає.

## Fix loop

- Rounds 1–3: findings отримує original implementer.
- Rounds 4–5: task переходить до fresh, more capable implementer.
- Після кожного fix запускаються focused tests.
- Reviewer перевіряє лише fix diff та попередні open findings.
- Новий finding може увійти в loop лише тоді, коли його створив fix.
- Після round 5 workflow зупиняється й передає реальний load-bearing blocker користувачу.

Minor observations записуються для final review і не блокують task, якщо вони не впливають на correctness або наступні work packages.

## Final gate

Після завершення всіх tasks coordinator має:

1. зробити whole-branch review від merge base;
2. одним fix wave виправити final findings;
3. зробити scoped re-review final fixes;
4. перечитати plan і перевірити кожен acceptance criterion;
5. свіжо запустити `bun test`, `bun run typecheck` і `bun run build`;
6. перевірити tracked, staged, unstaged та untracked files;
7. окремо перевірити secrets, generated artifacts і migration files;
8. лише після цього повідомити про завершення.

## Коли потрібне втручання користувача

Workflow продовжується автономно, крім ситуацій, коли:

- plan суперечить сам собі або product specification;
- потрібна нова зовнішня authority чи credential;
- зміна виходить за погоджений scope;
- п'ять fix rounds не усунули load-bearing finding;
- verification стабільно падає через причину, яку неможливо локально вирішити;
- потрібно обрати між двома різними product behaviors.
