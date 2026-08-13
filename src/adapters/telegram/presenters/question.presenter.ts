import type { CurrentQuestionView } from "@/application/use-cases/attempts/get-current-question";
import { QuizAttemptMode } from "@/domain/quiz-attempt/quiz-attempt";
import { type Question, QuestionType } from "@/domain/quiz-set/question";
import { CallbackAction } from "../callbacks/callback-data";
import { button, type InlineButton, type Screen } from "./menu.presenter";

/**
 * Telegram renders inline-keyboard labels on a single line and truncates what
 * does not fit, with no way to scroll or wrap. Anything longer than this moves
 * into the message body — which does wrap — and the button becomes its number.
 */
export const MAX_BUTTON_TEXT = 32;

/** Number buttons are narrow, so several fit on one row. */
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

const sessionHeading = (
	mode: QuizAttemptMode,
	topic: string | undefined,
): string | undefined => {
	switch (mode) {
		case QuizAttemptMode.Mistakes:
			return "🔁 Повторення помилок";
		case QuizAttemptMode.WeakTopics:
			return topic === undefined
				? "📉 Слабкі теми"
				: `📉 Слабка тема: ${topic}`;
		case QuizAttemptMode.Full:
			return undefined;
	}
};

const hintLine = (hint: string | undefined): string | undefined =>
	hint === undefined ? undefined : `\n💡 ${hint}`;

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
	const isMultiple = question.type === QuestionType.MultipleChoice;
	// Real authored options run past 100 characters; keeping their text on the
	// buttons would show the user roughly the first third of each one.
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
			sessionHeading(view.mode, question.topic),
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
			// Numbered buttons are narrow enough to share a row; full-text ones are
			// not, and stacking them keeps each readable.
			...(numbered ? chunk(optionRows) : optionRows.map((entry) => [entry])),
			...submit,
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}
