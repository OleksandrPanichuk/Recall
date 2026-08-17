import { describe, expect, test } from "bun:test";
import type { CurrentQuestionView } from "@/application/use-cases/attempts/get-current-question";
import {
	QuizAttemptStatus,
	toQuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import { createQuestion } from "@/domain/quiz-set/create-question";
import {
	Difficulty,
	QuestionType,
	toQuestionId,
	toQuestionOptionId,
} from "@/domain/quiz-set/question";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { decodeCallback } from "../callbacks/callback-data";
import { questionScreen } from "./question.presenter";

const LABELS = ["Alpha", "Bravo", "Charlie", "Delta"];

const aQuestion = (
	id: string,
	type: QuestionType = QuestionType.SingleChoice,
) =>
	createQuestion({
		id: toQuestionId(id),
		type,
		prompt: "Pick one",
		difficulty: Difficulty.Medium,
		position: 0,
		options: LABELS.map((text, index) => ({
			id: toQuestionOptionId(`${id}-${index}`),
			text,
			isCorrect: index === 0,
			position: index,
		})),
	});

const aView = (
	shuffleOptions: boolean,
	attemptId = "att-1",
): CurrentQuestionView => ({
	attemptId: toQuizAttemptId(attemptId),
	quizSetId: toQuizSetId("set-1"),
	quizSetTitle: "Set",
	status: QuizAttemptStatus.Active,
	index: 0,
	total: 1,
	awaitingFinish: false,
	shuffleOptions,
});

const shownOptions = (
	shuffleOptions: boolean,
	questionId = "q-1",
	attemptId = "att-1",
	type: QuestionType = QuestionType.SingleChoice,
): readonly { text: string; position: number }[] => {
	const question = aQuestion(questionId, type);
	const screen = questionScreen(aView(shuffleOptions, attemptId), question);

	const labelOf = (text: string): string | undefined =>
		LABELS.find((label) => text.endsWith(label));

	return screen.keyboard
		.flat()
		.filter((entry) => labelOf(entry.text) !== undefined)
		.map((entry) => {
			const callback = decodeCallback(entry.callback_data);

			if (callback === undefined || !("optionPositions" in callback)) {
				throw new Error(`button "${entry.text}" carries no option position`);
			}

			return {
				text: labelOf(entry.text) ?? entry.text,
				position: callback.optionPositions.at(-1) ?? -1,
			};
		});
};

describe("questionScreen option order", () => {
	test("keeps the authored order when shuffling is off", () => {
		expect(shownOptions(false).map((entry) => entry.text)).toEqual(LABELS);
	});

	test("moves the options when shuffling is on", () => {
		expect(shownOptions(true).map((entry) => entry.text)).not.toEqual(LABELS);
	});

	test("every shuffled button still carries its own authored position", () => {
		for (const entry of shownOptions(true)) {
			expect(entry.position).toBe(LABELS.indexOf(entry.text));
		}
	});

	test("every shuffled checkbox still carries its own authored position", () => {
		for (const entry of shownOptions(
			true,
			"q-1",
			"att-1",
			QuestionType.MultipleChoice,
		)) {
			expect(entry.position).toBe(LABELS.indexOf(entry.text));
		}
	});

	test("the numbering follows what is on screen, not the authored order", () => {
		const question = aQuestion("q-long", QuestionType.SingleChoice);
		const long = createQuestion({
			...question,
			options: question.options.map((option) => ({
				...option,
				text: `${option.text} ${"x".repeat(40)}`,
			})),
		});
		const screen = questionScreen(aView(true), long);
		const numbers = screen.keyboard
			.flat()
			.map((entry) => entry.text)
			.filter((text) => /^\d+$/.test(text));

		expect(numbers).toEqual(["1", "2", "3", "4"]);
	});

	test("the same attempt and question keep the same order", () => {
		expect(shownOptions(true)).toEqual(shownOptions(true));
	});

	test("a later attempt of the same question gets a different order", () => {
		const orders = new Set(
			["att-1", "att-2", "att-3", "att-4"].map((attemptId) =>
				shownOptions(true, "q-1", attemptId)
					.map((entry) => entry.text)
					.join(","),
			),
		);

		expect(orders.size).toBeGreaterThan(1);
	});
});
