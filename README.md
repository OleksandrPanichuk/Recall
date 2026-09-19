# Screenshots and recordings for the practice-loop pull requests

This is an orphan branch. It carries no code and is never merged. It exists
only so the pull request descriptions in the practice-loop stack can embed
images from a stable raw URL, because GitHub accepts media in a comment body
only through the web uploader and not through its API.

Every file was captured against the real app: the api, the web dev server,
Postgres, MinIO and Mailpit all running locally, driven through Chromium.
Each recording sits on the branch whose pull request it illustrates, so the
screen shows that change and nothing later in the stack.

| File | Pull request it belongs to |
| --- | --- |
| `gif/practice-hint.gif`, `shot/hint-revealed.png` | A hint that was written can now be shown during practice |
| `gif/finish-schedule-summary.gif`, `gif/finish-practice-untouched.gif`, `shot/finish-summary.png` | Finishing an attempt says what it scheduled |
| `gif/web-practice-modes.gif`, `shot/quiz-actions.png` | The web can practise mistakes and weak topics |
| `gif/review-chain.gif` | The Review screen reviews due-only attempts |
| `gif/retire-surfaces.gif`, `shot/review-screen.png`, `shot/retire-before.png`, `shot/retire-after.png` | Retiring a question is reachable from the bot and the browser |
