# Platform adapters

## Codex

- Use Codex's native sub-agent/delegation capability.
- Keep the root agent as coordinator.
- Dispatch one write-capable implementer at a time.
- Dispatch reviewers with read-only instructions and a bounded diff target.
- Resume the implementer for fix rounds when possible; use a fresh agent when context is lost or escalation is required.

## Claude Code

- Use Claude Code's Agent/Task subagents.
- Keep the main Claude session as coordinator.
- Give implementers explicit permission to edit only their task surface.
- Give reviewers an explicit read-only contract.
- Store the task brief, implementation report, review package, and progress ledger as files so the loop can resume after compaction.

## Platforms without independent subagents

Do not present an inline self-review as independent review. Use a separate fresh session or hand the review package to another agent. If neither is possible, tell the user the independent-review guarantee is unavailable and use a clearly labeled self-review fallback only with approval.

## Shared handoff contract

Every implementer returns:

- status: `done`, `done_with_concerns`, `needs_context`, or `blocked`;
- files changed;
- tests added or changed;
- exact verification commands and results;
- commit or diff boundary;
- remaining concerns.

Every reviewer returns:

- specification verdict;
- findings ordered by severity with file and line evidence;
- code-quality verdict;
- material test gaps or residual risks;
- `No findings` when no actionable issue exists.
