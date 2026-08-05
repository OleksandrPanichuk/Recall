import { describe, expect, test } from "bun:test";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";
import { QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import {
	CorruptedQuizSetRowError,
	type QuestionOptionRow,
	type QuestionRow,
	type QuizSetRow,
	toQuizSet,
	toQuizSetSummary,
} from "./quiz-set.mapper";

const aQuizSetRow = (overrides: Partial<QuizSetRow> = {}): QuizSetRow => ({
	id: "set-1",
	title: "Quiz set",
	description: null,
	language: "uk",
	source: null,
	source_chapters: null,
	tags: "[]",
	status: QuizSetStatus.Draft,
	created_at: "2026-08-01T00:00:00.000Z",
	updated_at: "2026-08-01T00:00:00.000Z",
	published_at: null,
	archived_at: null,
	...overrides,
});

const aQuestionRow = (overrides: Partial<QuestionRow> = {}): QuestionRow => ({
	id: "question-1",
	quiz_set_id: "set-1",
	type: QuestionType.SingleChoice,
	prompt: "Prompt",
	explanation: null,
	source_reference: null,
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
		question_id: "question-1",
		text: "Right",
		is_correct: 1,
		position: 0,
		...overrides,
	},
	{
		id: "option-2",
		question_id: "question-1",
		text: "Wrong",
		is_correct: 0,
		position: 1,
	},
];

// These rows cannot be produced through the database: quiz_sets.status,
// questions.type, questions.difficulty and question_options.is_correct all carry
// CHECK constraints. The mapper guards them anyway, so they are exercised here.
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

	test("rejects an is_correct value outside 0 and 1", () => {
		expect(() =>
			toQuizSet(aQuizSetRow(), [aQuestionRow()], optionRows({ is_correct: 2 })),
		).toThrow(CorruptedQuizSetRowError);
	});

	test("rejects an unsupported status in a summary row", () => {
		expect(() =>
			toQuizSetSummary({
				id: "set-1",
				title: "Quiz set",
				status: "retired",
				question_count: 0,
				updated_at: "2026-08-01T00:00:00.000Z",
			}),
		).toThrow(CorruptedQuizSetRowError);
	});
});
