import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import {
	createQuizSetsHarness,
	type QuizSetsHarness,
} from "@/application/use-cases/quiz-sets/quiz-sets.fixture";
import { QuizSetStatus, toQuizSetId } from "@/modules/quizzes";
import { QuizSetNotFoundError } from "..";
import type { ArchiveQuizSetUseCase } from "./archive-quiz-set";

let context: MemoryContext;
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
		const publishedAt = (await context.scope.quizzes.findById(quizSetId))
			?.publishedAt;
		context.clock.advance(60_000);

		await archive.execute({ quizSetId });
		const stored = await context.scope.quizzes.findById(quizSetId);

		expect(stored?.status).toBe(QuizSetStatus.Archived);
		expect(stored?.publishedAt).toEqual(publishedAt as Date);
	});

	test("archiving again keeps the original timestamp", async () => {
		const quizSetId = await newPublished();
		await archive.execute({ quizSetId });
		const first = (await context.scope.quizzes.findById(quizSetId))?.archivedAt;
		context.clock.advance(60_000);

		await archive.execute({ quizSetId });

		expect(
			(await context.scope.quizzes.findById(quizSetId))?.archivedAt,
		).toEqual(first as Date);
	});

	test("rejects an unknown set", async () => {
		await expect(
			archive.execute({ quizSetId: toQuizSetId("missing") }),
		).rejects.toThrow(QuizSetNotFoundError);
	});
});
