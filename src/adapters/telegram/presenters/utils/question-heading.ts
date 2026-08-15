import type { CurrentQuestionView } from "@/application/use-cases/attempts/get-current-question";

export const heading = (view: CurrentQuestionView): string =>
	`${view.quizSetTitle} — питання ${view.index + 1}/${view.total}`;

export const hintLine = (hint: string | undefined): string | undefined =>
	hint === undefined ? undefined : `\n💡 ${hint}`;
