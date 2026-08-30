import type { CurrentQuestionView } from "@recall/contracts";

export const heading = (view: CurrentQuestionView): string =>
	`${view.quizSetTitle} — питання ${view.index + 1}/${view.total}`;

export const hintLine = (hint: string | undefined): string | undefined =>
	hint === undefined ? undefined : `\n💡 ${hint}`;
