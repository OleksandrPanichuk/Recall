import { describe, expect, test } from "bun:test";
import { createQuestion } from "./create-question";
import {
	Difficulty,
	type Question,
	QuestionType,
	toQuestionId,
	toQuestionOptionId,
} from "./question";
import { questionFingerprint } from "./question-fingerprint";
import {
	addQuestions,
	archiveQuizSet,
	createQuizSet,
	isQuizSetStatus,
	publishQuizSet,
	type QuizSet,
	QuizSetStatus,
	toQuizSetId,
} from "./quiz-set";
import {
	DuplicateQuestionError,
	EmptyQuizSetError,
	QuizSetTransitionError,
	QuizSetValidationError,
} from "./quiz-set.errors";

const createdAt = new Date("2026-08-01T10:00:00.000Z");
const laterAt = new Date("2026-08-02T10:00:00.000Z");
const invalidDate = new Date("not a date");

const question = (prompt: string, position: number): Question =>
	createQuestion({
		id: toQuestionId(`question-${prompt}-${position}`),
		type: QuestionType.SingleChoice,
		prompt,
		difficulty: Difficulty.Medium,
		position,
		options: [
			{
				id: toQuestionOptionId(`${prompt}-${position}-0`),
				text: "Yes",
				isCorrect: true,
				position: 0,
			},
			{
				id: toQuestionOptionId(`${prompt}-${position}-1`),
				text: "No",
				isCorrect: false,
				position: 1,
			},
		],
	});

const validDraft = {
	id: toQuizSetId("quiz-set-1"),
	title: "  Designing Data-Intensive Applications  ",
	language: "  en  ",
	createdAt,
	description: "  Chapter 5 recap  ",
	source: "   ",
	tags: ["  replication  ", "replication", "  ", "storage"],
};

type QuizSetDraft = Parameters<typeof createQuizSet>[0];

const issuesOf = (draft: QuizSetDraft): readonly string[] => {
	try {
		createQuizSet(draft);
	} catch (caught) {
		return (caught as QuizSetValidationError).issues;
	}

	throw new Error("expected createQuizSet to throw");
};

const draftWith = (...questions: readonly Question[]): QuizSet =>
	addQuestions(createQuizSet(validDraft), questions, createdAt);

describe("QuizSet", () => {
	describe("isQuizSetStatus", () => {
		test.each(Object.values(QuizSetStatus))("accepts %p", (value) => {
			expect(isQuizSetStatus(value)).toBe(true);
		});

		test.each(["deleted", "", undefined, 1])("rejects %p", (value) => {
			expect(isQuizSetStatus(value)).toBe(false);
		});
	});

	describe("createQuizSet", () => {
		test("starts as a draft with no questions", () => {
			const quizSet = createQuizSet(validDraft);

			expect(quizSet.status).toBe(QuizSetStatus.Draft);
			expect(quizSet.questions).toHaveLength(0);
			expect(quizSet.updatedAt).toBe(createdAt);
			expect(quizSet.createdAt).toBe(createdAt);
			expect(quizSet.publishedAt).toBeUndefined();
			expect(quizSet.archivedAt).toBeUndefined();
		});

		test("trims the title and the language", () => {
			const quizSet = createQuizSet(validDraft);

			expect(quizSet.title).toBe("Designing Data-Intensive Applications");
			expect(quizSet.language).toBe("en");
		});

		test("trims and deduplicates tags and drops blank ones", () => {
			expect(createQuizSet(validDraft).tags).toEqual([
				"replication",
				"storage",
			]);
		});

		test("defaults tags to an empty list", () => {
			const { tags: _ignored, ...withoutTags } = validDraft;

			expect(createQuizSet(withoutTags).tags).toEqual([]);
		});

		test("trims optional fields and drops the blank ones", () => {
			const quizSet = createQuizSet({
				...validDraft,
				sourceChapters: "  5-7  ",
			});

			expect(quizSet.description).toBe("Chapter 5 recap");
			expect(quizSet.sourceChapters).toBe("5-7");
			expect(quizSet.source).toBeUndefined();
		});

		test("returns a frozen quiz set with frozen questions and tags", () => {
			const quizSet = createQuizSet(validDraft);

			expect(Object.isFrozen(quizSet)).toBe(true);
			expect(Object.isFrozen(quizSet.questions)).toBe(true);
			expect(Object.isFrozen(quizSet.tags)).toBe(true);
		});

		test("does not alias the caller's tags", () => {
			const tags = ["replication"];
			const quizSet = createQuizSet({ ...validDraft, tags });

			expect(Object.isFrozen(tags)).toBe(false);

			tags.push("storage");

			expect(quizSet.tags).toEqual(["replication"]);
		});

		test("rejects a blank title", () => {
			expect(issuesOf({ ...validDraft, title: "   " })).toEqual([
				"title must not be empty",
			]);
		});

		test("rejects a blank language", () => {
			expect(issuesOf({ ...validDraft, language: "" })).toEqual([
				"language must not be empty",
			]);
		});

		test("rejects an invalid createdAt", () => {
			expect(issuesOf({ ...validDraft, createdAt: invalidDate })).toEqual([
				"createdAt must be a valid date",
			]);
		});

		test("reports every issue at once in the documented order", () => {
			expect(
				issuesOf({
					...validDraft,
					title: " ",
					language: " ",
					createdAt: invalidDate,
				}),
			).toEqual([
				"title must not be empty",
				"language must not be empty",
				"createdAt must be a valid date",
			]);
		});

		test("names every issue in the error message", () => {
			expect(() => createQuizSet({ ...validDraft, title: " " })).toThrow(
				QuizSetValidationError,
			);
			expect(() => createQuizSet({ ...validDraft, title: " " })).toThrow(
				"Invalid quiz set:\n- title must not be empty",
			);
		});
	});

	describe("addQuestions", () => {
		test("appends questions and renumbers their positions", () => {
			const draft = createQuizSet(validDraft);
			const withTwo = addQuestions(
				draft,
				[question("first", 7), question("second", 9)],
				laterAt,
			);
			const withThree = addQuestions(withTwo, [question("third", 4)], laterAt);

			expect(withThree.questions.map((each) => each.position)).toEqual([
				0, 1, 2,
			]);
			expect(withThree.questions.map((each) => each.prompt)).toEqual([
				"first",
				"second",
				"third",
			]);
		});

		test("does not mutate the input set", () => {
			const draft = createQuizSet(validDraft);

			addQuestions(draft, [question("first", 0)], laterAt);

			expect(draft.questions).toHaveLength(0);
			expect(draft.updatedAt).toBe(createdAt);
		});

		test("does not alias the caller's batch", () => {
			const draft = createQuizSet(validDraft);
			const batch = [question("first", 0)];
			const updated = addQuestions(draft, batch, laterAt);

			batch.push(question("second", 1));

			expect(updated.questions).toHaveLength(1);
		});

		test("sets updatedAt and keeps the draft status", () => {
			const updated = addQuestions(
				createQuizSet(validDraft),
				[question("first", 0)],
				laterAt,
			);

			expect(updated.updatedAt).toBe(laterAt);
			expect(updated.status).toBe(QuizSetStatus.Draft);
		});

		test("returns a frozen quiz set with a frozen question list", () => {
			const updated = addQuestions(
				createQuizSet(validDraft),
				[question("first", 0)],
				laterAt,
			);

			expect(Object.isFrozen(updated)).toBe(true);
			expect(Object.isFrozen(updated.questions)).toBe(true);
		});

		test("rejects a question whose fingerprint is already in the set", () => {
			const existing = draftWith(question("first", 0));
			const duplicate = question("first", 5);

			expect(() => addQuestions(existing, [duplicate], laterAt)).toThrow(
				DuplicateQuestionError,
			);

			try {
				addQuestions(existing, [duplicate], laterAt);
			} catch (caught) {
				expect((caught as DuplicateQuestionError).fingerprints).toEqual([
					questionFingerprint(duplicate),
				]);
			}
		});

		test("rejects a batch that repeats a fingerprint inside itself", () => {
			const draft = createQuizSet(validDraft);
			const repeated = question("first", 1);

			try {
				addQuestions(draft, [question("first", 0), repeated], laterAt);
			} catch (caught) {
				expect(caught).toBeInstanceOf(DuplicateQuestionError);
				expect((caught as DuplicateQuestionError).fingerprints).toEqual([
					questionFingerprint(repeated),
				]);

				return;
			}

			throw new Error("expected addQuestions to throw");
		});

		test("reports every duplicate fingerprint once", () => {
			const existing = draftWith(question("first", 0));

			try {
				addQuestions(
					existing,
					[question("first", 1), question("second", 2), question("second", 3)],
					laterAt,
				);
			} catch (caught) {
				expect((caught as DuplicateQuestionError).fingerprints).toEqual([
					questionFingerprint(question("first", 0)),
					questionFingerprint(question("second", 0)),
				]);

				return;
			}

			throw new Error("expected addQuestions to throw");
		});

		test("rejects adding to a published set", () => {
			const published = publishQuizSet(
				draftWith(question("first", 0)),
				laterAt,
			);

			expect(() =>
				addQuestions(published, [question("second", 1)], laterAt),
			).toThrow(QuizSetTransitionError);
			expect(() =>
				addQuestions(published, [question("second", 1)], laterAt),
			).toThrow("A published quiz set cannot be modified");
		});

		test("rejects adding to an archived set", () => {
			const archived = archiveQuizSet(createQuizSet(validDraft), laterAt);

			expect(() =>
				addQuestions(archived, [question("first", 0)], laterAt),
			).toThrow(QuizSetTransitionError);
		});

		test("treats an empty batch as a no-op", () => {
			const existing = draftWith(question("first", 0));
			const updated = addQuestions(existing, [], laterAt);

			expect(updated.questions).toEqual(existing.questions);
			expect(updated.updatedAt).toBe(existing.updatedAt);
			expect(Object.isFrozen(updated)).toBe(true);
		});

		test("still refuses an empty batch when the set is not a draft", () => {
			const published = publishQuizSet(
				draftWith(question("first", 0)),
				laterAt,
			);

			expect(() => addQuestions(published, [], laterAt)).toThrow(
				QuizSetTransitionError,
			);
		});

		test("rejects an invalid at date", () => {
			const draft = createQuizSet(validDraft);

			expect(() =>
				addQuestions(draft, [question("first", 0)], invalidDate),
			).toThrow(QuizSetValidationError);
			expect(() =>
				addQuestions(draft, [question("first", 0)], invalidDate),
			).toThrow("Invalid quiz set:\n- at must be a valid date");
		});
	});

	describe("publishQuizSet", () => {
		test("publishes a draft that has questions", () => {
			const published = publishQuizSet(
				draftWith(question("first", 0)),
				laterAt,
			);

			expect(published.status).toBe(QuizSetStatus.Published);
			expect(published.publishedAt).toBe(laterAt);
			expect(published.updatedAt).toBe(laterAt);
			expect(Object.isFrozen(published)).toBe(true);
		});

		test("does not mutate the input set", () => {
			const draft = draftWith(question("first", 0));

			publishQuizSet(draft, laterAt);

			expect(draft.status).toBe(QuizSetStatus.Draft);
			expect(draft.publishedAt).toBeUndefined();
		});

		test("rejects a quiz set without questions", () => {
			const draft = createQuizSet(validDraft);

			expect(() => publishQuizSet(draft, laterAt)).toThrow(EmptyQuizSetError);
			expect(() => publishQuizSet(draft, laterAt)).toThrow(
				"A quiz set without questions cannot be published",
			);
		});

		test("rejects publishing twice", () => {
			const published = publishQuizSet(
				draftWith(question("first", 0)),
				laterAt,
			);

			expect(() => publishQuizSet(published, laterAt)).toThrow(
				QuizSetTransitionError,
			);
			expect(() => publishQuizSet(published, laterAt)).toThrow(
				"A published quiz set cannot be published",
			);
		});

		test("rejects publishing an archived set", () => {
			const archived = archiveQuizSet(draftWith(question("first", 0)), laterAt);

			expect(() => publishQuizSet(archived, laterAt)).toThrow(
				QuizSetTransitionError,
			);
		});

		test("rejects an invalid at date", () => {
			const draft = draftWith(question("first", 0));

			expect(() => publishQuizSet(draft, invalidDate)).toThrow(
				"Invalid quiz set:\n- at must be a valid date",
			);
		});
	});

	describe("archiveQuizSet", () => {
		test("archives a draft", () => {
			const archived = archiveQuizSet(createQuizSet(validDraft), laterAt);

			expect(archived.status).toBe(QuizSetStatus.Archived);
			expect(archived.archivedAt).toBe(laterAt);
			expect(archived.updatedAt).toBe(laterAt);
			expect(Object.isFrozen(archived)).toBe(true);
		});

		test("archives a published set and keeps publishedAt", () => {
			const published = publishQuizSet(
				draftWith(question("first", 0)),
				laterAt,
			);
			const archived = archiveQuizSet(published, laterAt);

			expect(archived.status).toBe(QuizSetStatus.Archived);
			expect(archived.publishedAt).toBe(laterAt);
			expect(archived.archivedAt).toBe(laterAt);
		});

		test("does not mutate the input set", () => {
			const draft = createQuizSet(validDraft);

			archiveQuizSet(draft, laterAt);

			expect(draft.status).toBe(QuizSetStatus.Draft);
			expect(draft.archivedAt).toBeUndefined();
		});

		test("rejects archiving twice", () => {
			const archived = archiveQuizSet(createQuizSet(validDraft), laterAt);

			expect(() => archiveQuizSet(archived, laterAt)).toThrow(
				QuizSetTransitionError,
			);
			expect(() => archiveQuizSet(archived, laterAt)).toThrow(
				"cannot be archived",
			);
		});

		test("rejects an invalid at date", () => {
			const draft = createQuizSet(validDraft);

			expect(() => archiveQuizSet(draft, invalidDate)).toThrow(
				"Invalid quiz set:\n- at must be a valid date",
			);
		});
	});
});
