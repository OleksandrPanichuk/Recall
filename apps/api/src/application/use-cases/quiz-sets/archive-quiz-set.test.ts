import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { TestContext } from "@tests/fixtures/application.fixture";
import { QuizSetStatus, toQuizSetId } from "@/domain/quiz-set/quiz-set";
import type { ArchiveQuizSetUseCase } from "./archive-quiz-set";
import {
	createQuizSetsHarness,
	type QuizSetsHarness,
} from "./quiz-sets.fixture";
import { QuizSetNotFoundError } from "./update-quiz-set";

let context: TestContext;
let archive: ArchiveQuizSetUseCase;
let newPublished: QuizSetsHarness["newPublished"];

beforeEach(() => {
	({ context, archive, newPublished } = createQuizSetsHarness());
});

afterEach(() => {
	context.close();
});

describe("ArchiveQuizSetUseCase", () => {
	test("archives a published set and keeps publishedAt", async () => {
		const quizSetId = await newPublished();
		const publishedAt = context.quizSets.findById(quizSetId)?.publishedAt;
		context.clock.advance(60_000);

		await archive.execute({ quizSetId });
		const stored = context.quizSets.findById(quizSetId);

		expect(stored?.status).toBe(QuizSetStatus.Archived);
		expect(stored?.publishedAt).toEqual(publishedAt as Date);
	});

	test("archiving again keeps the original timestamp", async () => {
		const quizSetId = await newPublished();
		await archive.execute({ quizSetId });
		const first = context.quizSets.findById(quizSetId)?.archivedAt;
		context.clock.advance(60_000);

		await archive.execute({ quizSetId });

		expect(context.quizSets.findById(quizSetId)?.archivedAt).toEqual(
			first as Date,
		);
	});

	test("rejects an unknown set", async () => {
		await expect(
			archive.execute({ quizSetId: toQuizSetId("missing") }),
		).rejects.toThrow(QuizSetNotFoundError);
	});
});
