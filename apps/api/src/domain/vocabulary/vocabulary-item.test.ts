import { describe, expect, test } from "bun:test";
import { toQuizSetId } from "../quiz-set/quiz-set";
import {
	cardsOf,
	createVocabularyItem,
	toVocabularyItemId,
	VocabularyDirection,
	type VocabularyItem,
	VocabularyItemValidationError,
} from "./vocabulary-item";

const createdAt = new Date("2026-08-15T10:00:00.000Z");

const anItem = (
	overrides: Partial<Parameters<typeof createVocabularyItem>[0]> = {},
): VocabularyItem =>
	createVocabularyItem({
		id: toVocabularyItemId("item-1"),
		quizSetId: toQuizSetId("set-1"),
		terms: ["cat"],
		translations: ["кіт"],
		createdAt,
		...overrides,
	});

const both = [
	VocabularyDirection.TermToTranslation,
	VocabularyDirection.TranslationToTerm,
];

describe("createVocabularyItem", () => {
	test("trims both sides", () => {
		const item = anItem({ terms: ["  cat "], translations: [" кіт  "] });

		expect(item.terms).toEqual(["cat"]);
		expect(item.translations).toEqual(["кіт"]);
	});

	test("keeps every accepted variant", () => {
		expect(anItem({ terms: ["colour", "color"] }).terms).toEqual([
			"colour",
			"color",
		]);
	});

	test.each([
		["no terms", { terms: [] }],
		["no translations", { translations: [] }],
		["an empty term", { terms: ["  "] }],
		["a repeated variant", { terms: ["cat", "CAT"] }],
	])("rejects %s", (_name, overrides) => {
		expect(() => anItem(overrides)).toThrow(VocabularyItemValidationError);
	});
});

describe("cardsOf", () => {
	test("makes one card per direction", () => {
		const cards = cardsOf(anItem(), both);

		expect(cards.map((card) => card.prompt)).toEqual(["cat", "кіт"]);
		expect(cards[0]?.acceptedAnswers).toEqual(["кіт"]);
		expect(cards[1]?.acceptedAnswers).toEqual(["cat"]);
	});

	test("accepts every variant in either direction", () => {
		const item = anItem({
			terms: ["colour", "color"],
			translations: ["колір"],
		});
		const cards = cardsOf(item, both);

		expect(cards[0]?.acceptedAnswers).toEqual(["колір"]);
		expect(cards[1]?.acceptedAnswers).toEqual(["colour", "color"]);
	});

	test("prompts with the first variant of the asked side", () => {
		const item = anItem({ terms: ["colour", "color"] });

		expect(cardsOf(item, both)[0]?.prompt).toBe("colour");
	});

	test("makes only what was asked for", () => {
		expect(
			cardsOf(anItem(), [VocabularyDirection.TranslationToTerm]),
		).toHaveLength(1);
	});

	test("does not repeat a direction", () => {
		expect(
			cardsOf(anItem(), [
				VocabularyDirection.TermToTranslation,
				VocabularyDirection.TermToTranslation,
			]),
		).toHaveLength(1);
	});

	test("makes one card when both sides are the same word", () => {
		expect(
			cardsOf(anItem({ terms: ["taxi"], translations: ["taxi"] }), both),
		).toHaveLength(1);
	});

	test("offers the transcription as a hint when asked for the term", () => {
		const item = anItem({ transcription: "/kæt/" });
		const cards = cardsOf(item, both);

		expect(cards[0]?.hint).toBeUndefined();
		expect(cards[1]?.hint).toBe("/kæt/");
	});
});
