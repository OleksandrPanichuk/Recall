import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	DuplicateQuestionError,
	QuizSetTransitionError,
} from "@/domain/quiz-set/quiz-set.errors";
import {
	toVocabularyItemId,
	VocabularyDirection,
	type VocabularyItemId,
	VocabularyItemValidationError,
} from "@/domain/vocabulary/vocabulary-item";
import {
	createQuizSetsHarness,
	type QuizSetsHarness,
} from "./quiz-sets.fixture";
import {
	type UpdateVocabularyUseCase,
	VocabularyItemNotFoundError,
} from "./update-vocabulary";

let context: MemoryContext;
let addVocabulary: QuizSetsHarness["addVocabulary"];
let update: UpdateVocabularyUseCase;
let newDraft: QuizSetsHarness["newDraft"];
let publish: QuizSetsHarness["publish"];
let archive: QuizSetsHarness["archive"];

const bothWays = [
	VocabularyDirection.TermToTranslation,
	VocabularyDirection.TranslationToTerm,
];

const addOne = async (
	quizSetId: QuizSetId,
	directions = bothWays,
): Promise<VocabularyItemId> => {
	const { itemIds } = await addVocabulary.execute({
		quizSetId,
		directions,
		pairs: [{ term: ["cat"], translation: ["кыт"] }],
	});
	const itemId = itemIds[0];

	if (itemId === undefined) throw new Error("nothing was added");

	return itemId;
};

const cardsOfItem = async (quizSetId: QuizSetId, itemId: VocabularyItemId) =>
	((await context.scope.quizzes.findById(quizSetId))?.questions ?? []).filter(
		(question) => question.vocabularyItemId === String(itemId),
	);

beforeEach(() => {
	({
		context,
		addVocabulary,
		updateVocabulary: update,
		newDraft,
		publish,
		archive,
	} = createQuizSetsHarness());
});

afterEach(() => {
	context.close();
});

describe("UpdateVocabularyUseCase", () => {
	test("keeps every question id, so the repetition history survives", async () => {
		const quizSetId = await newDraft();
		const itemId = await addOne(quizSetId);
		const before = (await cardsOfItem(quizSetId, itemId)).map(
			(card) => card.id,
		);

		await update.execute({ itemId, translation: ["кіт"] });

		expect(
			(await cardsOfItem(quizSetId, itemId)).map((card) => card.id),
		).toEqual(before);
	});

	test("fixes both directions from a single correction", async () => {
		const quizSetId = await newDraft();
		const itemId = await addOne(quizSetId);

		const result = await update.execute({ itemId, translation: ["кіт"] });
		const cards = await cardsOfItem(quizSetId, itemId);

		expect(result.rebuiltQuestionCount).toBe(2);
		expect(cards.map((card) => card.prompt).sort()).toEqual(["cat", "кіт"]);
		expect(
			cards.flatMap((card) => card.options.map((option) => option.text)).sort(),
		).toEqual(["cat", "кіт"]);
	});

	test("rebuilds a one-way item without inventing the other direction", async () => {
		const quizSetId = await newDraft();
		const itemId = await addOne(quizSetId, [
			VocabularyDirection.TranslationToTerm,
		]);

		const result = await update.execute({ itemId, translation: ["кіт"] });
		const cards = await cardsOfItem(quizSetId, itemId);

		expect(result.rebuiltQuestionCount).toBe(1);
		expect(cards).toHaveLength(1);
		expect(cards[0]?.prompt).toBe("кіт");
	});

	test("changes only what it was given", async () => {
		const quizSetId = await newDraft();
		const itemId = await addOne(quizSetId);

		await update.execute({ itemId, transcription: "/kæt/" });
		const stored = await context.scope.termPairs.findById(itemId);

		expect(stored?.terms).toEqual(["cat"]);
		expect(stored?.translations).toEqual(["кыт"]);
		expect(stored?.transcription).toBe("/kæt/");
	});

	test("leaves the other items in the set alone", async () => {
		const quizSetId = await newDraft();
		const itemId = await addOne(quizSetId);
		const { itemIds } = await addVocabulary.execute({
			quizSetId,
			directions: bothWays,
			pairs: [{ term: ["dog"], translation: ["пес"] }],
		});
		const other = itemIds[0];

		if (other === undefined) throw new Error("nothing was added");

		const untouched = await cardsOfItem(quizSetId, other);

		await update.execute({ itemId, translation: ["кіт"] });

		expect(await cardsOfItem(quizSetId, other)).toEqual(untouched);
	});

	test("corrects a published set, which is the only kind you study", async () => {
		const quizSetId = await newDraft();
		const itemId = await addOne(quizSetId);

		await publish.execute({ quizSetId });
		await update.execute({ itemId, translation: ["кіт"] });

		expect(
			(await cardsOfItem(quizSetId, itemId)).map((card) => card.prompt).sort(),
		).toEqual(["cat", "кіт"]);
	});

	test("the repetition history stays attached to the corrected card", async () => {
		const quizSetId = await newDraft();
		const itemId = await addOne(quizSetId);
		const card = (await cardsOfItem(quizSetId, itemId))[0];

		if (card === undefined) throw new Error("no card was generated");

		await context.unitOfWork.run(({ reviews }) =>
			reviews.saveSchedules([
				{
					questionId: card.id,
					repetitionCount: 4,
					lapses: 1,
					lastCompletedAt: new Date("2026-08-01T10:00:00.000Z"),
					dueAt: new Date("2026-08-15T10:00:00.000Z"),
				},
			]),
		);

		await update.execute({ itemId, translation: ["кіт"] });
		const [schedule] = await context.scope.reviews.findSchedules([card.id]);

		expect(schedule?.repetitionCount).toBe(4);
		expect(schedule?.lapses).toBe(1);
		expect(schedule?.dueAt?.toISOString()).toBe("2026-08-15T10:00:00.000Z");
	});

	test("keeps the two cards apart when a word appears on both sides", async () => {
		const quizSetId = await newDraft();
		const { itemIds } = await addVocabulary.execute({
			quizSetId,
			directions: bothWays,
			pairs: [{ term: ["kot", "cat"], translation: ["cat"] }],
		});
		const itemId = itemIds[0];

		if (itemId === undefined) throw new Error("nothing was added");

		const result = await update.execute({ itemId, transcription: "/kɔt/" });

		expect(result.rebuiltQuestionCount).toBe(2);
		expect(
			(await cardsOfItem(quizSetId, itemId)).map((card) => card.prompt).sort(),
		).toEqual(["cat", "kot"]);
	});

	test("refuses a correction that duplicates another word", async () => {
		const quizSetId = await newDraft();

		await addVocabulary.execute({
			quizSetId,
			directions: [VocabularyDirection.TermToTranslation],
			pairs: [{ term: ["cat"], translation: ["кіт"] }],
		});

		const { itemIds } = await addVocabulary.execute({
			quizSetId,
			directions: [VocabularyDirection.TermToTranslation],
			pairs: [{ term: ["cat"], translation: ["кыт"] }],
		});
		const itemId = itemIds[0];

		if (itemId === undefined) throw new Error("nothing was added");

		await expect(
			update.execute({ itemId, translation: ["кіт"] }),
		).rejects.toThrow(DuplicateQuestionError);

		expect(
			(await context.scope.termPairs.findById(itemId))?.translations,
		).toEqual(["кыт"]);
	});

	test("drops the card a correction leaves without a word to ask", async () => {
		const quizSetId = await newDraft();
		const itemId = await addOne(quizSetId);

		await addVocabulary.execute({
			quizSetId,
			directions: bothWays,
			pairs: [{ term: ["dog"], translation: ["пес"] }],
		});

		const result = await update.execute({ itemId, translation: ["cat"] });
		const cards = await cardsOfItem(quizSetId, itemId);

		expect(result.removedQuestionCount).toBe(1);
		expect(cards).toHaveLength(1);
		expect(cards[0]?.prompt).toBe("cat");
	});

	test("refuses to touch an archived set", async () => {
		const quizSetId = await newDraft();
		const itemId = await addOne(quizSetId);

		await publish.execute({ quizSetId });
		await archive.execute({ quizSetId });

		await expect(
			update.execute({ itemId, translation: ["кіт"] }),
		).rejects.toThrow(QuizSetTransitionError);
	});

	test("refuses a clock that went backwards instead of writing an unreadable row", async () => {
		const quizSetId = await newDraft();
		const itemId = await addOne(quizSetId);

		context.clock.set(new Date("2020-01-01T00:00:00.000Z"));

		await expect(
			update.execute({ itemId, translation: ["кіт"] }),
		).rejects.toThrow(VocabularyItemValidationError);

		expect(
			(await context.scope.termPairs.findById(itemId))?.translations,
		).toEqual(["кыт"]);
	});

	test("rejects an item that does not exist", async () => {
		await expect(
			update.execute({ itemId: toVocabularyItemId("ghost"), term: ["cat"] }),
		).rejects.toThrow(VocabularyItemNotFoundError);
	});
});
