import { describe, expect, test } from "bun:test";
import type { QuestionRow } from "@recall/contracts";
import {
	matching,
	neverAnswered,
} from "@/features/authoring/ui/views/QuestionBankView/QuestionBankView.lib";

const row = (
	prompt: string,
	setTitle: string,
	over: { topic?: string; answerCount?: number } = {},
): QuestionRow =>
	({
		question: {
			id: prompt,
			type: "single_choice",
			prompt,
			options: [],
			difficulty: "easy",
			position: 0,
			topic: over.topic,
		},
		quizSetId: setTitle,
		setTitle,
		setStatus: "published",
		answerCount: over.answerCount ?? 0,
	}) as QuestionRow;

const bank = [
	row("What is the WAL?", "Postgres", { topic: "durability", answerCount: 4 }),
	row("How many bytes in a UUID?", "Postgres"),
	row("Which runtime runs this?", "Bun", { answerCount: 1 }),
];

describe("searching the question bank", () => {
	test("an empty query keeps every question", () => {
		expect(matching(bank, "   ")).toHaveLength(3);
	});

	test("matches the prompt, ignoring case", () => {
		expect(matching(bank, "RUNTIME").map((r) => r.setTitle)).toEqual(["Bun"]);
	});

	test("matches the topic, which the prompt never names", () => {
		expect(matching(bank, "durability")).toHaveLength(1);
	});

	test("matches the set title, so a whole set can be pulled up", () => {
		expect(matching(bank, "postgres")).toHaveLength(2);
	});

	test("finds nothing rather than everything when nothing matches", () => {
		expect(matching(bank, "kafka")).toEqual([]);
	});
});

describe("what the caption counts", () => {
	test("questions no attempt has ever reached", () => {
		expect(neverAnswered(bank)).toBe(1);
	});

	test("nothing, once every question has been answered", () => {
		expect(neverAnswered(bank.filter((r) => r.answerCount > 0))).toBe(0);
	});
});
