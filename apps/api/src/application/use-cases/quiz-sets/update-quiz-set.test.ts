import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { TestContext } from "@tests/fixtures/application.fixture";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { QuizSetTransitionError } from "@/domain/quiz-set/quiz-set.errors";
import {
	createQuizSetsHarness,
	type QuizSetsHarness,
} from "./quiz-sets.fixture";
import { QuizSetNotFoundError, type UpdateQuizSet } from "./update-quiz-set";

let context: TestContext;
let update: UpdateQuizSet;
let newDraft: QuizSetsHarness["newDraft"];
let newPublished: QuizSetsHarness["newPublished"];
let newArchived: QuizSetsHarness["newArchived"];

beforeEach(() => {
	({ context, update, newDraft, newPublished, newArchived } =
		createQuizSetsHarness());
});

afterEach(() => {
	context.close();
});

describe("UpdateQuizSet", () => {
	test("changes only the fields it was given", async () => {
		const quizSetId = await newDraft();
		context.clock.advance(60_000);

		await update.execute({ quizSetId, title: "Renamed" });
		const stored = context.quizSets.findById(quizSetId);

		expect(stored?.title).toBe("Renamed");
		expect(stored?.language).toBe("uk");
		expect(stored?.updatedAt.toISOString()).toBe("2026-08-01T10:01:00.000Z");
	});

	test("rejects an unknown set", async () => {
		await expect(
			update.execute({ quizSetId: toQuizSetId("missing"), title: "Renamed" }),
		).rejects.toThrow(QuizSetNotFoundError);
	});

	test("edits a published set, because a title is not part of the history", async () => {
		const quizSetId = await newPublished();
		context.clock.advance(60_000);

		await update.execute({ quizSetId, title: "Renamed" });

		expect(context.quizSets.findById(quizSetId)?.title).toBe("Renamed");
	});

	test("refuses to edit an archived set", async () => {
		const quizSetId = await newArchived();
		context.clock.advance(60_000);

		await expect(
			update.execute({ quizSetId, title: "Renamed" }),
		).rejects.toThrow(QuizSetTransitionError);
		expect(context.quizSets.findById(quizSetId)?.title).toBe("Bun persistence");
	});
});
