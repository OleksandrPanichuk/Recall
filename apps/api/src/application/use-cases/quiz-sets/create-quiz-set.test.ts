import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import { QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import { QuizSetValidationError } from "@/domain/quiz-set/quiz-set.errors";
import type { CreateQuizSetUseCase } from "./create-quiz-set";
import {
	createQuizSetsHarness,
	type QuizSetsHarness,
} from "./quiz-sets.fixture";

let context: MemoryContext;
let create: CreateQuizSetUseCase;
let newDraft: QuizSetsHarness["newDraft"];

beforeEach(() => {
	({ context, create, newDraft } = createQuizSetsHarness());
});

afterEach(() => {
	context.close();
});

describe("CreateQuizSetUseCase", () => {
	test("stores a draft and returns its id", async () => {
		const quizSetId = await newDraft();
		const stored = context.quizSets.findById(quizSetId);

		expect(String(quizSetId)).toBe("id-1");
		expect(stored?.title).toBe("Bun persistence");
		expect(stored?.status).toBe(QuizSetStatus.Draft);
		expect(stored?.questions).toHaveLength(0);
	});

	test("stamps the timestamps from the clock", async () => {
		context.clock.set(new Date("2026-08-04T09:00:00.000Z"));

		const stored = context.quizSets.findById(await newDraft());

		expect(stored?.createdAt.toISOString()).toBe("2026-08-04T09:00:00.000Z");
		expect(stored?.updatedAt.toISOString()).toBe("2026-08-04T09:00:00.000Z");
	});

	test("keeps and normalises the optional metadata", async () => {
		const { quizSetId } = await create.execute({
			title: "Bun persistence",
			language: "uk",
			description: "Drills",
			source: "DDIA",
			sourceChapters: "1-3",
			tags: ["bun", "bun", " sqlite "],
		});
		const stored = context.quizSets.findById(quizSetId);

		expect(stored?.description).toBe("Drills");
		expect(stored?.source).toBe("DDIA");
		expect(stored?.tags).toEqual(["bun", "sqlite"]);
	});

	test("rejects an empty title and stores nothing", async () => {
		await expect(
			create.execute({ title: "   ", language: "uk" }),
		).rejects.toThrow(QuizSetValidationError);
		expect(context.quizSets.list()).toEqual([]);
	});
});
