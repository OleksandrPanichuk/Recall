import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import { anAnswer, anAttempt } from "@tests/fixtures/quiz-attempt.fixture";
import { recordResponse } from "@/domain/quiz-attempt/quiz-attempt";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { ListQuestionsUseCase } from "./list-questions";
import {
	anotherQuestionInput,
	aQuestionInput,
	createQuizSetsHarness,
	type QuizSetsHarness,
} from "./quiz-sets.fixture";

let context: MemoryContext;
let add: QuizSetsHarness["add"];
let create: QuizSetsHarness["create"];
let publish: QuizSetsHarness["publish"];
let list: ListQuestionsUseCase;

const newSet = async (title: string): Promise<QuizSetId> => {
	const { quizSetId } = await create.execute({ title, language: "uk" });

	return quizSetId;
};

beforeEach(() => {
	({ context, add, create, publish } = createQuizSetsHarness());
	list = new ListQuestionsUseCase(context);
});

afterEach(() => {
	context.close();
});

describe("ListQuestionsUseCase", () => {
	test("returns nothing when there are no sets", async () => {
		expect(await list.execute({})).toEqual([]);
	});

	test("reports every question with the set it belongs to", async () => {
		const quizSetId = await newSet("SQLite basics");

		await add.execute({
			quizSetId,
			questions: [aQuestionInput(), anotherQuestionInput()],
		});

		const rows = await list.execute({});

		expect(rows).toHaveLength(2);
		expect(rows.map((row) => row.setTitle)).toEqual([
			"SQLite basics",
			"SQLite basics",
		]);
		expect(rows.map((row) => row.quizSetId)).toEqual([quizSetId, quizSetId]);
		expect(rows.map((row) => row.question.position)).toEqual([0, 1]);
	});

	test("spans every set, so the admin can search across all of them", async () => {
		const first = await newSet("First");
		const second = await newSet("Second");

		await add.execute({ quizSetId: first, questions: [aQuestionInput()] });
		await add.execute({ quizSetId: second, questions: [aQuestionInput()] });

		const rows = await list.execute({});

		expect(rows.map((row) => row.setTitle).sort()).toEqual(["First", "Second"]);
	});

	test("narrows to one set when asked", async () => {
		const first = await newSet("First");
		const second = await newSet("Second");

		await add.execute({ quizSetId: first, questions: [aQuestionInput()] });
		await add.execute({ quizSetId: second, questions: [aQuestionInput()] });

		const rows = await list.execute({ quizSetId: second });

		expect(rows.map((row) => row.setTitle)).toEqual(["Second"]);
	});

	test("reports the status of the set, which decides what may change", async () => {
		const quizSetId = await newSet("SQLite basics");

		await add.execute({ quizSetId, questions: [aQuestionInput()] });
		await publish.execute({ quizSetId });

		const rows = await list.execute({});

		expect(rows[0]?.setStatus).toBe("published");
	});

	test("counts recorded answers, which is why a question cannot be deleted", async () => {
		const quizSetId = await newSet("SQLite basics");

		await add.execute({ quizSetId, questions: [aQuestionInput()] });

		const before = await list.execute({});
		const questionId = String(before[0]?.question.id);

		expect(before[0]?.answerCount).toBe(0);

		context.attempts.save(
			recordResponse(
				anAttempt({
					quizSetId: String(quizSetId),
					questionIds: [questionId],
				}),
				anAnswer(questionId, true, new Date("2026-08-01T10:05:00.000Z")),
			),
		);

		const after = await list.execute({});

		expect(after[0]?.answerCount).toBe(1);
	});

	test("survives an unknown set id", async () => {
		expect(
			await list.execute({ quizSetId: "missing" as unknown as QuizSetId }),
		).toEqual([]);
	});
});
