import type { CurrentQuestionView, Question } from "@recall/contracts";
import { expectsTypedAnswer, QuestionType } from "@recall/contracts";
import { shuffled } from "@recall/kit";
import { CallbackAction } from "../callbacks/callback-data.constants";
import { matchingQuestionScreen } from "./matching-question.presenter";
import { orderingQuestionScreen } from "./ordering-question.presenter";
import type { InlineButton, Screen } from "./screen.types";
import { typedQuestionScreen } from "./typed-question.presenter";
import { button } from "./utils/button";
import { heading, hintLine } from "./utils/question-heading";

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

export const MAX_OPTION_LABEL = 20;

export function questionScreen(
	view: CurrentQuestionView,
	question: Question,
	selected: readonly number[] = [],
): Screen {
	if (expectsTypedAnswer(question)) {
		return typedQuestionScreen(view, question);
	}

	if (question.type === QuestionType.Ordering) {
		return orderingQuestionScreen(view, question, selected);
	}

	if (question.type === QuestionType.Matching) {
		return matchingQuestionScreen(view, question, selected);
	}

	const isMultiple = question.type === QuestionType.MultipleChoice;
	const markWidth = isMultiple ? [..."⬜️ "].length : 0;
	const numbered = question.options.some(
		(option) => [...option.text].length + markWidth > MAX_OPTION_LABEL,
	);
	const mark = (position: number): string =>
		isMultiple ? (selected.includes(position) ? "☑️ " : "⬜️ ") : "";
	const shown = view.shuffleOptions
		? shuffled(question.options, `${view.attemptId}:${question.id}`)
		: question.options;

	const optionRows = shown.map((option, index) => {
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
				? `${mark(option.position)}${index + 1}`
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
			heading(view),
			"",
			question.prompt,
			numbered
				? `\n${shown
						.map(
							(option, index) =>
								`${mark(option.position)}${index + 1}. ${option.text}`,
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
