import type { CurrentQuestionView } from "@/application/use-cases/attempts/get-current-question";
import { matchingSides, type Question } from "@/domain/quiz-set/question";
import { shuffled } from "@/shared/utils/shuffle";
import { CallbackAction } from "../callbacks/callback-data.constants";
import type { InlineButton, Screen } from "./screen.types";
import { button } from "./utils/button";
import { heading, hintLine } from "./utils/question-heading";
import { truncated } from "./utils/truncate";

// Selections arrive as a flat left, right, left, right sequence. An odd length
// means a left is waiting for its partner, which is what drives the keyboard.
export function matchingQuestionScreen(
	view: CurrentQuestionView,
	question: Question,
	selected: readonly number[],
): Screen {
	const { left, right } = matchingSides(question);
	const textAt = (position: number): string =>
		question.options.find((option) => option.position === position)?.text ?? "";
	const pending = selected.length % 2 === 1 ? selected.at(-1) : undefined;
	const taken = new Set(selected);
	const pairs: string[] = [];

	for (let index = 0; index + 1 < selected.length; index += 2) {
		pairs.push(
			`${textAt(selected[index] as number)} — ${textAt(selected[index + 1] as number)}`,
		);
	}

	const choices =
		pending === undefined
			? left.filter((option) => !taken.has(option.position))
			: shuffled(
					right.filter((option) => !taken.has(option.position)),
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
		selected.length === question.options.length
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
			pairs.length === 0 ? undefined : pairs.join("\n"),
			`Зіставлено ${pairs.length}/${left.length}`,
			selected.length === question.options.length
				? "Усе зіставлено — натисніть Відповісти."
				: pending === undefined
					? "Оберіть слово ліворуч."
					: `Оберіть пару для «${textAt(pending)}».`,
			hintLine(question.hint),
		]
			.filter((line) => line !== undefined)
			.join("\n"),
		keyboard: [
			...choices.map((option) => [
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
