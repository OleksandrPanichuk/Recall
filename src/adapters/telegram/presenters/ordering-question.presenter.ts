import type { CurrentQuestionView } from "@/application/use-cases/attempts/get-current-question";
import type { Question } from "@/domain/quiz-set/question";
import { shuffled } from "@/shared/utils/shuffle";
import { CallbackAction } from "../callbacks/callback-data.constants";
import type { InlineButton, Screen } from "./screen.types";
import { button } from "./utils/button";
import { heading, hintLine } from "./utils/question-heading";
import { truncated } from "./utils/truncate";

export function orderingQuestionScreen(
	view: CurrentQuestionView,
	question: Question,
	selected: readonly number[],
): Screen {
	const textAt = (position: number): string =>
		question.options.find((option) => option.position === position)?.text ?? "";

	const remaining = shuffled(
		question.options.filter((option) => !selected.includes(option.position)),
		String(question.id),
	);

	const reset: InlineButton[][] =
		selected.length === 0
			? []
			: [
					[
						button("↩️ Скинути", {
							action: CallbackAction.Toggle,
							questionId: question.id,
							optionPositions: [],
						}),
					],
				];

	const submit: InlineButton[][] =
		remaining.length === 0
			? [
					[
						button("✅ Відповісти", {
							action: CallbackAction.Answer,
							questionId: question.id,
							optionPositions: selected,
						}),
					],
				]
			: [];

	return {
		text: [
			heading(view),
			"",
			question.prompt,
			"",
			selected.length === 0
				? "Натискайте слова у правильному порядку."
				: selected
						.map((position, index) => `${index + 1}. ${textAt(position)}`)
						.join("\n"),
			hintLine(question.hint),
		]
			.filter((line) => line !== undefined)
			.join("\n"),
		keyboard: [
			...remaining.map((option) => [
				button(truncated(option.text), {
					action: CallbackAction.Toggle,
					questionId: question.id,
					optionPositions: [...selected, option.position],
				}),
			]),
			...reset,
			...submit,
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}
