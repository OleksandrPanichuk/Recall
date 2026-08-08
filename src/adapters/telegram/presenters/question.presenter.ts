import type { CurrentQuestionView } from "@/application/use-cases/attempts/get-current-question";
import { type Question, QuestionType } from "@/domain/quiz-set/question";
import { CallbackAction } from "../callbacks/callback-data";
import { button, type Screen } from "./menu.presenter";

const toggled = (
	selected: readonly number[],
	position: number,
): readonly number[] =>
	selected.includes(position)
		? selected.filter((entry) => entry !== position)
		: [...selected, position].toSorted((left, right) => left - right);

/**
 * Renders the current question. The explanation and the correct options are
 * deliberately absent — they only ever reach the user through the feedback
 * screen, after an answer has been recorded.
 */
export function questionScreen(
	view: CurrentQuestionView,
	question: Question,
	selected: readonly number[] = [],
): Screen {
	const header = `${view.quizSetTitle} — питання ${view.index + 1}/${view.total}`;
	const isMultiple = question.type === QuestionType.MultipleChoice;

	const options = question.options.map((option) => [
		button(
			isMultiple && selected.includes(option.position)
				? `☑️ ${option.text}`
				: isMultiple
					? `⬜️ ${option.text}`
					: option.text,
			isMultiple
				? {
						action: CallbackAction.Toggle,
						questionId: question.id,
						optionPositions: toggled(selected, option.position),
					}
				: {
						action: CallbackAction.Answer,
						questionId: question.id,
						optionPositions: [option.position],
					},
		),
	]);

	const submit = isMultiple
		? [
				[
					button(selected.length === 0 ? "Оберіть варіанти" : "✅ Відповісти", {
						action: CallbackAction.Answer,
						questionId: question.id,
						optionPositions: selected,
					}),
				],
			]
		: [];

	return {
		text: [header, "", question.prompt, hintLine(question.hint)]
			.filter((line) => line !== undefined)
			.join("\n"),
		keyboard: [
			...options,
			...submit,
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}

const hintLine = (hint: string | undefined): string | undefined =>
	hint === undefined ? undefined : `\n💡 ${hint}`;
