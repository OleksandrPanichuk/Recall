---
name: run-reviewed-development
description: Execute a written software implementation plan through an independent implement-review-fix-re-review loop. Use when the user asks agents to implement tasks autonomously, have another agent review each task, fix actionable findings, re-review fixes until convergence, and perform final verification in Codex, Claude Code, or another subagent-capable coding agent.
---

# Run Reviewed Development

Coordinate the work; do not implement or review changes in the coordinator context.

## Preconditions

1. Read repository instructions, applicable architecture documentation, and the feature specification.
2. Require a written plan with independently testable tasks and acceptance criteria. If it is missing, create it with `writing-plans` before execution.
3. Require a Git repository and an isolated feature branch or worktree. Never implement on `main` or `master` without explicit approval.
4. Record the initial commit, current worktree status, and verification commands.
5. Create a persistent progress ledger that identifies the plan and survives context compaction.

Use `test-driven-development`, `requesting-code-review`, `subagent-driven-development`, and `verification-before-completion` when those companion skills are available.

## Roles

- **Coordinator:** owns the plan, task state, dispatches, evidence, and escalation. It does not edit code.
- **Implementer:** owns one task, writes tests first, implements, verifies, and reports changed files and commands.
- **Reviewer:** is independent and read-only. It checks both requirement compliance and code quality from the task brief and exact diff.
- **Fixer:** normally resume the original implementer. Use a fresh, stronger implementer after three unsuccessful fix rounds.
- **Final reviewer:** reviews the complete branch diff after all task gates pass.

Never run two write-capable agents concurrently in the same worktree.

## Per-task loop

For every plan task:

1. Record `BASE_SHA` before dispatching work.
2. Give a fresh implementer only the task brief, binding project and architecture constraints, relevant interfaces, and required verification commands.
3. Require TDD for behavior changes: demonstrate the expected failing test, implement minimally, then show passing focused tests.
4. Inspect the resulting diff and verification evidence. Do not trust the implementer's completion claim by itself.
5. Give an independent read-only reviewer the task brief and exact `BASE_SHA..HEAD` diff. Do not provide the implementer's reasoning history.
6. Require two verdicts:
   - specification compliance;
   - architecture, correctness, security, maintainability, and test quality.
7. If both pass, record the task as complete and continue.
8. If findings exist, classify them:
   - `critical` or `important`: must enter the fix loop;
   - `minor`: record for final review unless it is trivial and in scope;
   - conflicts with the written plan: ask the user which requirement governs.
9. Send actionable findings verbatim to the implementer. Require focused tests and a fix report.
10. Give a reviewer only the fix diff and open findings. Require `addressed` or `not addressed` for each finding and allow new findings only when introduced by the fix.
11. Repeat the fix and scoped re-review loop up to five rounds.
12. After round three, switch to a fresh, more capable implementer.
13. At round five, stop. Escalate any real, load-bearing finding to the user; record non-blocking disputed findings with an explicit ruling.

## Final gate

After all task gates pass:

1. Run a whole-branch review against the merge base with the most capable available reviewer.
2. Give one fixer the complete final finding set, then run one scoped re-review of that fix wave.
3. Re-read the specification and check each acceptance criterion against code or test evidence.
4. Run the full repository verification commands freshly.
5. Inspect the final status and diff for unrelated, generated, untracked, or secret-bearing files.
6. Report completion only when the evidence supports it. Otherwise report the exact remaining blocker.

## Dispatch hygiene

- Use files for long briefs, diffs, reports, and ledgers instead of pasting accumulated history.
- Give each agent the minimum context needed for its role.
- Review the actual changed surface, including untracked files when applicable.
- A reviewer never edits; an implementer never approves its own work.
- A fix is not accepted without independent scoped re-review.
- Preserve user changes and keep unrelated failures out of scope while still reporting them accurately.

Read [platforms.md](references/platforms.md) when selecting the Codex or Claude dispatch mechanism.
