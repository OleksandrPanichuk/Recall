import type { CurrentQuestionView } from "@/application/use-cases/attempts/get-current-question";
import { type Question, QuestionType } from "@/domain/quiz-set/question";
import { CallbackAction } from "../callbacks/callback-data.constants";
import type { InlineButton, Screen } from "./screen.types";
import { button } from "./utils/button";

export const MAX_BUTTON_TEXT = 32;

const BUTTONS_PER_ROW = 5;

const toggled = (
	selected: readonly number[],
	position: number,
): readonly number[] =>
	selected.includes(position)
		? selected.filter((entry) => entry !== position)
		: [...selected, position].toSorted((left, right) => left - right);

const chunk = (
	buttons: readonly InlineButton[],
): readonly (readonly InlineButton[])[] => {
	const rows: InlineButton[][] = [];

	for (const entry of buttons) {
		const last = rows.at(-1);

		if (last === undefined || last.length === BUTTONS_PER_ROW) {
			rows.push([entry]);
		} else {
			last.push(entry);
		}
	}

	return rows;
};

const hintLine = (hint: string | undefined): string | undefined =>
	hint === undefined ? undefined : `\n💡 ${hint}`;

export function questionScreen(
	view: CurrentQuestionView,
	question: Question,
	selected: readonly number[] = [],
): Screen {
	const isMultiple = question.type === QuestionType.MultipleChoice;
	const numbered = question.options.some(
		(option) => option.text.length > MAX_BUTTON_TEXT,
	);
	const mark = (position: number): string =>
		isMultiple ? (selected.includes(position) ? "☑️ " : "⬜️ ") : "";

	const optionRows = question.options.map((option) => {
		const callback = isMultiple
			? {
					action: CallbackAction.Toggle,
					questionId: question.id,
					optionPositions: toggled(selected, option.position),
				}
			: {
					action: CallbackAction.Answer,
					questionId: question.id,
					optionPositions: [option.position],
				};

		return button(
			numbered
				? `${mark(option.position)}${option.position + 1}`
				: `${mark(option.position)}${option.text}`,
			callback,
		);
	});

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
		text: [
			`${view.quizSetTitle} — питання ${view.index + 1}/${view.total}`,
			"",
			question.prompt,
			numbered
				? `\n${question.options
						.map(
							(option) =>
								`${mark(option.position)}${option.position + 1}. ${option.text}`,
						)
						.join("\n")}`
				: undefined,
			hintLine(question.hint),
		]
			.filter((line) => line !== undefined)
			.join("\n"),
		keyboard: [
			...(numbered ? chunk(optionRows) : optionRows.map((entry) => [entry])),
			...submit,
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}
