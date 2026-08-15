import { describe, expect, test } from "bun:test";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import { QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import {
	CorruptedQuizSetRowError,
	toQuizSet,
	toQuizSetSummary,
} from "./quiz-set.mapper";
import type {
	QuestionOptionRow,
	QuestionRow,
	QuizSetRow,
} from "./quiz-set.mapper.types";

const aQuizSetRow = (overrides: Partial<QuizSetRow> = {}): QuizSetRow => ({
	id: "set-1",
	title: "Quiz set",
	description: null,
	language: "uk",
	source: null,
	sourceChapters: null,
	tags: "[]",
	status: QuizSetStatus.Draft,
	createdAt: "2026-08-01T00:00:00.000Z",
	updatedAt: "2026-08-01T00:00:00.000Z",
	publishedAt: null,
	archivedAt: null,
	folderId: null,
	...overrides,
});

const aQuestionRow = (overrides: Partial<QuestionRow> = {}): QuestionRow => ({
	id: "question-1",
	quizSetId: "set-1",
	type: QuestionType.SingleChoice,
	prompt: "Prompt",
	explanation: null,
	sourceReference: null,
	topic: null,
	difficulty: Difficulty.Medium,
	hint: null,
	position: 0,
	fingerprint: "fingerprint-1",
	...overrides,
});

const optionRows = (
	overrides: Partial<QuestionOptionRow> = {},
): readonly QuestionOptionRow[] => [
	{
		id: "option-1",
		questionId: "question-1",
		text: "Right",
		isCorrect: true,
		position: 0,
		...overrides,
	},
	{
		id: "option-2",
		questionId: "question-1",
		text: "Wrong",
		isCorrect: false,
		position: 1,
	},
];

describe("quiz set mapper", () => {
	test("restores a question with its options", () => {
		const quizSet = toQuizSet(aQuizSetRow(), [aQuestionRow()], optionRows());

		expect(
			quizSet.questions[0]?.options.map((option) => option.isCorrect),
		).toEqual([true, false]);
	});

	test("rejects an unsupported quiz set status", () => {
		expect(() => toQuizSet(aQuizSetRow({ status: "retired" }), [], [])).toThrow(
			CorruptedQuizSetRowError,
		);
	});

	test("rejects an unsupported question type", () => {
		expect(() =>
			toQuizSet(aQuizSetRow(), [aQuestionRow({ type: "essay" })], optionRows()),
		).toThrow(CorruptedQuizSetRowError);
	});

	test("rejects an unsupported difficulty", () => {
		expect(() =>
			toQuizSet(
				aQuizSetRow(),
				[aQuestionRow({ difficulty: "brutal" })],
				optionRows(),
			),
		).toThrow(CorruptedQuizSetRowError);
	});

	test("rejects an unsupported status in a summary row", () => {
		expect(() =>
			toQuizSetSummary({
				id: "set-1",
				title: "Quiz set",
				status: "retired",
				questionCount: 0,
				updatedAt: "2026-08-01T00:00:00.000Z",
			}),
		).toThrow(CorruptedQuizSetRowError);
	});
});
