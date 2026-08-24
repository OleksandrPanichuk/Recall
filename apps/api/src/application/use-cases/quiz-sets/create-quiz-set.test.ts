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
		const stored = await context.scope.quizzes.findById(quizSetId);

		expect(String(quizSetId)).toMatch(
			/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i,
		);
		expect(stored?.title).toBe("Bun persistence");
		expect(stored?.status).toBe(QuizSetStatus.Draft);
		expect(stored?.questions).toHaveLength(0);
	});

	test("stamps the timestamps from the clock", async () => {
		context.clock.set(new Date("2026-08-04T09:00:00.000Z"));

		const stored = await context.scope.quizzes.findById(await newDraft());

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
		const stored = await context.scope.quizzes.findById(quizSetId);

		expect(stored?.description).toBe("Drills");
		expect(stored?.source).toBe("DDIA");
		expect(stored?.tags).toEqual(["bun", "sqlite"]);
	});

	test("rejects an empty title and stores nothing", async () => {
		await expect(
			create.execute({ title: "   ", language: "uk" }),
		).rejects.toThrow(QuizSetValidationError);
		expect(await context.scope.quizzes.list()).toEqual([]);
	});
});
