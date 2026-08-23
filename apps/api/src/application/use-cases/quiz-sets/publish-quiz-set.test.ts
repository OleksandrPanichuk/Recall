import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import { QuizSetStatus, toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { EmptyQuizSetError } from "@/domain/quiz-set/quiz-set.errors";
import type { PublishQuizSetUseCase } from "./publish-quiz-set";
import {
	createQuizSetsHarness,
	type QuizSetsHarness,
} from "./quiz-sets.fixture";
import { QuizSetNotFoundError } from "./update-quiz-set";

let context: MemoryContext;
let publish: PublishQuizSetUseCase;
let newDraft: QuizSetsHarness["newDraft"];
let newPublished: QuizSetsHarness["newPublished"];

beforeEach(() => {
	({ context, publish, newDraft, newPublished } = createQuizSetsHarness());
});

afterEach(() => {
	context.close();
});

describe("PublishQuizSetUseCase", () => {
	test("publishes a draft that has questions", async () => {
		const quizSetId = await newPublished();
		const stored = context.quizSets.findById(quizSetId);

		expect(stored?.status).toBe(QuizSetStatus.Published);
		expect(stored?.publishedAt).toBeDefined();
	});

	test("publishing again keeps the original timestamp", async () => {
		const quizSetId = await newPublished();
		const first = context.quizSets.findById(quizSetId)?.publishedAt;
		context.clock.advance(60_000);

		await publish.execute({ quizSetId });

		expect(context.quizSets.findById(quizSetId)?.publishedAt).toEqual(
			first as Date,
		);
	});

	test("refuses a set with no questions", async () => {
		const quizSetId = await newDraft();

		await expect(publish.execute({ quizSetId })).rejects.toThrow(
			EmptyQuizSetError,
		);
		expect(context.quizSets.findById(quizSetId)?.status).toBe(
			QuizSetStatus.Draft,
		);
	});

	test("rejects an unknown set", async () => {
		await expect(
			publish.execute({ quizSetId: toQuizSetId("missing") }),
		).rejects.toThrow(QuizSetNotFoundError);
	});
});
