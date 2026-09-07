import { describe, expect, test } from "bun:test";
import { toPageId } from "@/modules/pages";
import { createQuestion } from "./create-question";
import {
	Difficulty,
	QuestionEntity,
	type QuestionId,
	type QuestionOption,
	QuestionType,
	toQuestionId,
	toQuestionOptionId,
} from "./question.entity";
import { questionFingerprint } from "./question-fingerprint";
import {
	isQuizSetStatus,
	QuizSetEntity,
	QuizSetStatus,
	toQuizSetId,
} from "./quiz-set.entity";
import {
	DuplicateQuestionError,
	DuplicateQuestionIdError,
	EmptyQuizSetError,
	QuizSetTransitionError,
	QuizSetValidationError,
} from "./quizzes.errors";

const createdAt = new Date("2026-08-01T10:00:00.000Z");
const laterAt = new Date("2026-08-02T10:00:00.000Z");
const earlierAt = new Date("2026-07-31T10:00:00.000Z");
const invalidDate = new Date("not a date");

const rawOption = (
	text: string,
	isCorrect: boolean,
	position: number,
): QuestionOption => ({
	id: toQuestionOptionId(`${text}-${position}`),
	text,
	isCorrect,
	position,
});

const question = (prompt: string, position: number): QuestionEntity =>
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

const withId = (source: QuestionEntity, id: QuestionId): QuestionEntity => ({
	...source,
	id,
});

const withPrompt = (
	source: QuestionEntity,
	prompt: string,
): QuestionEntity => ({
	...source,
	prompt,
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

type QuizSetDraft = Parameters<typeof QuizSetEntity.create>[0];

const issuesOf = (draft: QuizSetDraft): readonly string[] => {
	try {
		QuizSetEntity.create(draft);
	} catch (caught) {
		return (caught as QuizSetValidationError).issues;
	}

	throw new Error("expected QuizSetEntity.create to throw");
};

const draftWith = (...questions: readonly QuestionEntity[]): QuizSetEntity =>
	QuizSetEntity.addQuestions(
		QuizSetEntity.create(validDraft),
		questions,
		createdAt,
	);

const duplicateIdsOf = (
	quizSet: QuizSetEntity,
	questions: readonly QuestionEntity[],
): readonly QuestionId[] => {
	try {
		QuizSetEntity.addQuestions(quizSet, questions, laterAt);
	} catch (caught) {
		expect(caught).toBeInstanceOf(DuplicateQuestionIdError);

		return (caught as DuplicateQuestionIdError).questionIds;
	}

	throw new Error("expected QuizSetEntity.addQuestions to throw");
};

describe("QuizSet", () => {
	describe("isQuizSetStatus", () => {
		test.each(Object.values(QuizSetStatus))("accepts %p", (value) => {
			expect(isQuizSetStatus(value)).toBe(true);
		});

		test.each([
			"deleted",
			"",
			"Draft",
			undefined,
			null,
			1,
			{},
		])("rejects %p", (value) => {
			expect(isQuizSetStatus(value)).toBe(false);
		});
	});

	describe("createQuizSet", () => {
		test("starts as a draft with no questions", () => {
			const quizSet = QuizSetEntity.create(validDraft);

			expect(quizSet.status).toBe(QuizSetStatus.Draft);
			expect(quizSet.questions).toHaveLength(0);
			expect(quizSet.updatedAt).toEqual(createdAt);
			expect(quizSet.createdAt).toEqual(createdAt);
			expect(quizSet.publishedAt).toBeUndefined();
			expect(quizSet.archivedAt).toBeUndefined();
		});

		test("trims the title and the language", () => {
			const quizSet = QuizSetEntity.create(validDraft);

			expect(quizSet.title).toBe("Designing Data-Intensive Applications");
			expect(quizSet.language).toBe("en");
		});

		test("trims and deduplicates tags and drops blank ones", () => {
			expect(QuizSetEntity.create(validDraft).tags).toEqual([
				"replication",
				"storage",
			]);
		});

		test("treats tags differing only in case as distinct", () => {
			expect(
				QuizSetEntity.create({ ...validDraft, tags: ["Bun", "bun"] }).tags,
			).toEqual(["Bun", "bun"]);
		});

		test("defaults tags to an empty list", () => {
			const { tags: _ignored, ...withoutTags } = validDraft;

			expect(QuizSetEntity.create(withoutTags).tags).toEqual([]);
		});

		test("trims optional fields and drops the blank ones", () => {
			const quizSet = QuizSetEntity.create({
				...validDraft,
				sourceChapters: "  5-7  ",
			});

			expect(quizSet.description).toBe("Chapter 5 recap");
			expect(quizSet.sourceChapters).toBe("5-7");
			expect(quizSet.source).toBeUndefined();
		});

		test("returns a frozen quiz set with frozen questions and tags", () => {
			const quizSet = QuizSetEntity.create(validDraft);

			expect(Object.isFrozen(quizSet)).toBe(true);
			expect(Object.isFrozen(quizSet.questions)).toBe(true);
			expect(Object.isFrozen(quizSet.tags)).toBe(true);
		});

		test("does not alias the caller's tags", () => {
			const tags = ["replication"];
			const quizSet = QuizSetEntity.create({ ...validDraft, tags });

			expect(Object.isFrozen(tags)).toBe(false);

			tags.push("storage");

			expect(quizSet.tags).toEqual(["replication"]);
		});

		test("copies createdAt so later mutation cannot reach the aggregate", () => {
			const mutable = new Date(createdAt.getTime());
			const quizSet = QuizSetEntity.create({
				...validDraft,
				createdAt: mutable,
			});

			mutable.setFullYear(1999);

			expect(quizSet.createdAt).toEqual(createdAt);
			expect(quizSet.updatedAt).toEqual(createdAt);
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
			expect(() => QuizSetEntity.create({ ...validDraft, title: " " })).toThrow(
				QuizSetValidationError,
			);
			expect(() => QuizSetEntity.create({ ...validDraft, title: " " })).toThrow(
				"Invalid quiz set:\n- title must not be empty",
			);
		});
	});

	describe("addQuestions", () => {
		test("appends questions and renumbers their positions", () => {
			const draft = QuizSetEntity.create(validDraft);
			const withTwo = QuizSetEntity.addQuestions(
				draft,
				[question("first", 7), question("second", 9)],
				laterAt,
			);
			const withThree = QuizSetEntity.addQuestions(
				withTwo,
				[question("third", 4)],
				laterAt,
			);

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
			const draft = QuizSetEntity.create(validDraft);

			QuizSetEntity.addQuestions(draft, [question("first", 0)], laterAt);

			expect(draft.questions).toHaveLength(0);
			expect(draft.updatedAt).toEqual(createdAt);
		});

		test("does not alias the caller's batch", () => {
			const draft = QuizSetEntity.create(validDraft);
			const batch = [question("first", 0)];
			const updated = QuizSetEntity.addQuestions(draft, batch, laterAt);

			batch.push(question("second", 1));

			expect(updated.questions).toHaveLength(1);
		});

		test("sets updatedAt and keeps the draft status", () => {
			const updated = QuizSetEntity.addQuestions(
				QuizSetEntity.create(validDraft),
				[question("first", 0)],
				laterAt,
			);

			expect(updated.updatedAt).toEqual(laterAt);
			expect(updated.status).toBe(QuizSetStatus.Draft);
		});

		test("copies the transition date", () => {
			const mutable = new Date(laterAt.getTime());
			const updated = QuizSetEntity.addQuestions(
				QuizSetEntity.create(validDraft),
				[question("first", 0)],
				mutable,
			);

			mutable.setFullYear(1999);

			expect(updated.updatedAt).toEqual(laterAt);
		});

		test("returns a frozen quiz set with a frozen question list", () => {
			const updated = QuizSetEntity.addQuestions(
				QuizSetEntity.create(validDraft),
				[question("first", 0)],
				laterAt,
			);

			expect(Object.isFrozen(updated)).toBe(true);
			expect(Object.isFrozen(updated.questions)).toBe(true);
		});

		test("freezes each stored question down to its options", () => {
			const options = [rawOption("Yes", true, 0), rawOption("No", false, 1)];
			const raw: QuestionEntity = {
				id: toQuestionId("raw-question"),
				type: QuestionType.SingleChoice,
				prompt: "Assembled without createQuestion",
				difficulty: Difficulty.Medium,
				position: 0,
				options,
			};
			const updated = QuizSetEntity.addQuestions(
				QuizSetEntity.create(validDraft),
				[raw],
				laterAt,
			);
			const stored = updated.questions[0];

			expect(Object.isFrozen(stored)).toBe(true);
			expect(Object.isFrozen(stored?.options)).toBe(true);
			expect(Object.isFrozen(stored?.options[0])).toBe(true);
			expect(Object.isFrozen(options)).toBe(false);

			options.push(rawOption("Maybe", true, 2));

			expect(stored?.options).toHaveLength(2);
		});

		test("rejects a question id already in the set", () => {
			const existing = draftWith(question("first", 0));
			const reused = withId(
				question("second", 1),
				toQuestionId("question-first-0"),
			);

			expect(duplicateIdsOf(existing, [reused])).toEqual([reused.id]);
			expect(() =>
				QuizSetEntity.addQuestions(existing, [reused], laterAt),
			).toThrow(
				"A quiz set cannot contain duplicate question ids:\n- question-first-0",
			);
		});

		test("rejects a question id repeated inside the batch", () => {
			const first = question("first", 0);
			const clash = withPrompt(first, "Totally different");

			expect(
				duplicateIdsOf(QuizSetEntity.create(validDraft), [first, clash]),
			).toEqual([first.id]);
		});

		test("reports an id repeated three times exactly once", () => {
			const first = question("first", 0);

			expect(
				duplicateIdsOf(QuizSetEntity.create(validDraft), [
					first,
					withPrompt(first, "Second variant"),
					withPrompt(first, "Third variant"),
				]),
			).toEqual([first.id]);
		});

		test("reports duplicate ids in batch order", () => {
			const first = question("first", 0);
			const second = question("second", 1);

			expect(
				duplicateIdsOf(QuizSetEntity.create(validDraft), [
					first,
					second,
					withPrompt(second, "Second variant"),
					withPrompt(first, "First variant"),
				]),
			).toEqual([second.id, first.id]);
		});

		test("reports a duplicate id before a duplicate fingerprint", () => {
			const existing = draftWith(question("first", 0));
			const idClash = withId(
				question("second", 1),
				toQuestionId("question-first-0"),
			);

			expect(() =>
				QuizSetEntity.addQuestions(
					existing,
					[question("first", 2), idClash],
					laterAt,
				),
			).toThrow(DuplicateQuestionIdError);
		});

		test("rejects a question whose fingerprint is already in the set", () => {
			const existing = draftWith(question("first", 0));
			const duplicate = question("first", 5);

			expect(() =>
				QuizSetEntity.addQuestions(existing, [duplicate], laterAt),
			).toThrow(DuplicateQuestionError);

			try {
				QuizSetEntity.addQuestions(existing, [duplicate], laterAt);
			} catch (caught) {
				expect((caught as DuplicateQuestionError).fingerprints).toEqual([
					questionFingerprint(duplicate),
				]);
			}
		});

		test("rejects a batch that repeats a fingerprint inside itself", () => {
			const draft = QuizSetEntity.create(validDraft);
			const repeated = question("first", 1);

			try {
				QuizSetEntity.addQuestions(
					draft,
					[question("first", 0), repeated],
					laterAt,
				);
			} catch (caught) {
				expect(caught).toBeInstanceOf(DuplicateQuestionError);
				expect((caught as DuplicateQuestionError).fingerprints).toEqual([
					questionFingerprint(repeated),
				]);

				return;
			}

			throw new Error("expected QuizSetEntity.addQuestions to throw");
		});

		test("reports every duplicate fingerprint once", () => {
			const existing = draftWith(question("first", 0));

			try {
				QuizSetEntity.addQuestions(
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

			throw new Error("expected QuizSetEntity.addQuestions to throw");
		});

		test("appends to a published set, keeping the positions in order", () => {
			const published = QuizSetEntity.publish(
				draftWith(question("first", 0)),
				laterAt,
			);
			const grown = QuizSetEntity.addQuestions(
				published,
				[question("second", 9)],
				laterAt,
			);

			expect(grown.status).toBe(QuizSetStatus.Published);
			expect(grown.questions.map((entry) => entry.position)).toEqual([0, 1]);
			expect(grown.questions.map((entry) => String(entry.id))).toEqual([
				"question-first-0",
				"question-second-9",
			]);
		});

		test("still refuses a duplicate in a published set", () => {
			const published = QuizSetEntity.publish(
				draftWith(question("first", 0)),
				laterAt,
			);

			expect(() =>
				QuizSetEntity.addQuestions(published, [question("first", 5)], laterAt),
			).toThrow(DuplicateQuestionError);
		});

		test("rejects adding to an archived set", () => {
			const archived = QuizSetEntity.archive(
				QuizSetEntity.create(validDraft),
				laterAt,
			);

			expect(() =>
				QuizSetEntity.addQuestions(archived, [question("first", 0)], laterAt),
			).toThrow(QuizSetTransitionError);
		});

		test("treats an empty batch as a no-op", () => {
			const existing = draftWith(question("first", 0));
			const updated = QuizSetEntity.addQuestions(existing, [], laterAt);

			expect(updated.questions).toEqual(existing.questions);
			expect(updated.updatedAt).toEqual(existing.updatedAt);
			expect(Object.isFrozen(updated)).toBe(true);
		});

		test("still refuses an empty batch when the set is archived", () => {
			const archived = QuizSetEntity.archive(
				draftWith(question("first", 0)),
				laterAt,
			);

			expect(() => QuizSetEntity.addQuestions(archived, [], laterAt)).toThrow(
				QuizSetTransitionError,
			);
		});

		test("rejects an invalid at date", () => {
			const draft = QuizSetEntity.create(validDraft);

			expect(() =>
				QuizSetEntity.addQuestions(draft, [question("first", 0)], invalidDate),
			).toThrow(QuizSetValidationError);
			expect(() =>
				QuizSetEntity.addQuestions(draft, [question("first", 0)], invalidDate),
			).toThrow("Invalid quiz set:\n- at must be a valid date");
		});

		test("rejects an at date that precedes createdAt", () => {
			const draft = QuizSetEntity.create(validDraft);

			expect(() =>
				QuizSetEntity.addQuestions(draft, [question("first", 0)], earlierAt),
			).toThrow(QuizSetValidationError);
			expect(() =>
				QuizSetEntity.addQuestions(draft, [question("first", 0)], earlierAt),
			).toThrow("Invalid quiz set:\n- at must not precede createdAt");
		});

		test("accepts an at date equal to createdAt", () => {
			const updated = QuizSetEntity.addQuestions(
				QuizSetEntity.create(validDraft),
				[question("first", 0)],
				createdAt,
			);

			expect(updated.updatedAt).toEqual(createdAt);
		});

		test("rejects adding questions before the current updatedAt", () => {
			const firstUpdateAt = new Date("2026-08-03T10:00:00.000Z");
			const earlierAt = new Date("2026-08-02T10:00:00.000Z");
			const updatedDraft = QuizSetEntity.addQuestions(
				QuizSetEntity.create(validDraft),
				[question("first", 0)],
				firstUpdateAt,
			);

			expect(() =>
				QuizSetEntity.addQuestions(
					updatedDraft,
					[question("second", 1)],
					earlierAt,
				),
			).toThrow(new QuizSetValidationError(["at must not precede updatedAt"]));
		});

		test("reports the transition failure before an invalid at date", () => {
			const archived = QuizSetEntity.archive(
				QuizSetEntity.create(validDraft),
				laterAt,
			);

			expect(() =>
				QuizSetEntity.addQuestions(
					archived,
					[question("first", 0)],
					invalidDate,
				),
			).toThrow(QuizSetTransitionError);
		});
	});

	describe("publishQuizSet", () => {
		test("publishes a draft that has questions", () => {
			const published = QuizSetEntity.publish(
				draftWith(question("first", 0)),
				laterAt,
			);

			expect(published.status).toBe(QuizSetStatus.Published);
			expect(published.publishedAt).toEqual(laterAt);
			expect(published.updatedAt).toEqual(laterAt);
			expect(Object.isFrozen(published)).toBe(true);
		});

		test("copies the publish date", () => {
			const mutable = new Date(laterAt.getTime());
			const published = QuizSetEntity.publish(
				draftWith(question("first", 0)),
				mutable,
			);

			mutable.setFullYear(1999);

			expect(published.publishedAt).toEqual(laterAt);
			expect(published.updatedAt).toEqual(laterAt);
		});

		test("does not mutate the input set", () => {
			const draft = draftWith(question("first", 0));

			QuizSetEntity.publish(draft, laterAt);

			expect(draft.status).toBe(QuizSetStatus.Draft);
			expect(draft.publishedAt).toBeUndefined();
		});

		test("rejects a quiz set without questions", () => {
			const draft = QuizSetEntity.create(validDraft);

			expect(() => QuizSetEntity.publish(draft, laterAt)).toThrow(
				EmptyQuizSetError,
			);
			expect(() => QuizSetEntity.publish(draft, laterAt)).toThrow(
				"A quiz set needs at least one question",
			);
		});

		test("rejects publishing twice", () => {
			const published = QuizSetEntity.publish(
				draftWith(question("first", 0)),
				laterAt,
			);

			expect(() => QuizSetEntity.publish(published, laterAt)).toThrow(
				QuizSetTransitionError,
			);
			expect(() => QuizSetEntity.publish(published, laterAt)).toThrow(
				"A published quiz set cannot be published",
			);
		});

		test("rejects publishing an archived set", () => {
			const archived = QuizSetEntity.archive(
				draftWith(question("first", 0)),
				laterAt,
			);

			expect(() => QuizSetEntity.publish(archived, laterAt)).toThrow(
				QuizSetTransitionError,
			);
		});

		test("rejects an invalid at date", () => {
			const draft = draftWith(question("first", 0));

			expect(() => QuizSetEntity.publish(draft, invalidDate)).toThrow(
				"Invalid quiz set:\n- at must be a valid date",
			);
		});

		test("reports an invalid at date before the empty question list", () => {
			const draft = QuizSetEntity.create(validDraft);

			expect(() => QuizSetEntity.publish(draft, invalidDate)).toThrow(
				QuizSetValidationError,
			);
		});

		test("rejects an at date that precedes createdAt", () => {
			const draft = draftWith(question("first", 0));

			expect(() => QuizSetEntity.publish(draft, earlierAt)).toThrow(
				"Invalid quiz set:\n- at must not precede createdAt",
			);
		});

		test("rejects publishing before the current updatedAt", () => {
			const firstUpdateAt = new Date("2026-08-03T10:00:00.000Z");
			const earlierAt = new Date("2026-08-02T10:00:00.000Z");
			const updatedDraft = QuizSetEntity.addQuestions(
				QuizSetEntity.create(validDraft),
				[question("first", 0)],
				firstUpdateAt,
			);

			expect(() => QuizSetEntity.publish(updatedDraft, earlierAt)).toThrow(
				new QuizSetValidationError(["at must not precede updatedAt"]),
			);
		});
	});

	describe("archiveQuizSet", () => {
		test("archives a draft", () => {
			const archived = QuizSetEntity.archive(
				QuizSetEntity.create(validDraft),
				laterAt,
			);

			expect(archived.status).toBe(QuizSetStatus.Archived);
			expect(archived.archivedAt).toEqual(laterAt);
			expect(archived.updatedAt).toEqual(laterAt);
			expect(Object.isFrozen(archived)).toBe(true);
		});

		test("archives a published set and keeps publishedAt", () => {
			const published = QuizSetEntity.publish(
				draftWith(question("first", 0)),
				laterAt,
			);
			const archived = QuizSetEntity.archive(published, laterAt);

			expect(archived.status).toBe(QuizSetStatus.Archived);
			expect(archived.publishedAt).toEqual(laterAt);
			expect(archived.archivedAt).toEqual(laterAt);
		});

		test("does not mutate the input set", () => {
			const draft = QuizSetEntity.create(validDraft);

			QuizSetEntity.archive(draft, laterAt);

			expect(draft.status).toBe(QuizSetStatus.Draft);
			expect(draft.archivedAt).toBeUndefined();
		});

		test("rejects archiving twice", () => {
			const archived = QuizSetEntity.archive(
				QuizSetEntity.create(validDraft),
				laterAt,
			);

			expect(() => QuizSetEntity.archive(archived, laterAt)).toThrow(
				QuizSetTransitionError,
			);
			expect(() => QuizSetEntity.archive(archived, laterAt)).toThrow(
				"cannot be archived",
			);
		});

		test("rejects an invalid at date", () => {
			const draft = QuizSetEntity.create(validDraft);

			expect(() => QuizSetEntity.archive(draft, invalidDate)).toThrow(
				"Invalid quiz set:\n- at must be a valid date",
			);
		});

		test("rejects an at date that precedes createdAt", () => {
			const draft = QuizSetEntity.create(validDraft);

			expect(() => QuizSetEntity.archive(draft, earlierAt)).toThrow(
				"Invalid quiz set:\n- at must not precede createdAt",
			);
		});

		test("rejects archiving before the current updatedAt", () => {
			const publishedAt = new Date("2026-08-03T10:00:00.000Z");
			const earlierAt = new Date("2026-08-02T10:00:00.000Z");
			const published = QuizSetEntity.publish(
				draftWith(question("first", 0)),
				publishedAt,
			);

			expect(() => QuizSetEntity.archive(published, earlierAt)).toThrow(
				new QuizSetValidationError(["at must not precede updatedAt"]),
			);
		});

		test("accepts a transition at the current updatedAt", () => {
			const updatedAt = new Date("2026-08-03T10:00:00.000Z");
			const published = QuizSetEntity.publish(
				draftWith(question("first", 0)),
				updatedAt,
			);

			expect(QuizSetEntity.archive(published, updatedAt).updatedAt).toEqual(
				updatedAt,
			);
		});
	});
});

describe("moveQuizSetToFolder", () => {
	const filed = (): QuizSetEntity =>
		QuizSetEntity.moveToPage(
			draftWith(question("Filed?", 0)),
			toPageId("english"),
			laterAt,
		);

	test("files a draft into a folder", () => {
		expect(filed().folderId).toBe(toPageId("english"));
	});

	test("clears the folder when given undefined", () => {
		expect(QuizSetEntity.moveToPage(filed(), undefined, laterAt).folderId).toBe(
			undefined,
		);
	});

	test("files a published set, because filing is not content", () => {
		const published = QuizSetEntity.publish(
			draftWith(question("Filed?", 0)),
			laterAt,
		);

		const moved = QuizSetEntity.moveToPage(
			published,
			toPageId("english"),
			laterAt,
		);

		expect(moved.folderId).toBe(toPageId("english"));
		expect(moved.status).toBe(QuizSetStatus.Published);
		expect(moved.questions).toHaveLength(published.questions.length);
	});

	test("files an archived set", () => {
		const archived = QuizSetEntity.archive(
			draftWith(question("Filed?", 0)),
			laterAt,
		);

		expect(
			QuizSetEntity.moveToPage(archived, toPageId("english"), laterAt).folderId,
		).toBe(toPageId("english"));
	});

	test("advances updatedAt", () => {
		expect(filed().updatedAt).toEqual(laterAt);
	});

	test("refuses a timestamp that runs backwards", () => {
		expect(() =>
			QuizSetEntity.moveToPage(
				draftWith(question("Filed?", 0)),
				toPageId("x"),
				earlierAt,
			),
		).toThrow(QuizSetValidationError);
	});

	test("refuses an invalid timestamp", () => {
		expect(() =>
			QuizSetEntity.moveToPage(
				draftWith(question("Filed?", 0)),
				toPageId("x"),
				invalidDate,
			),
		).toThrow(QuizSetValidationError);
	});
});
