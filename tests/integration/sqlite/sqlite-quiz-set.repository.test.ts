import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDrizzleClient } from "@/adapters/persistence/sqlite/database";
import { CorruptedQuizSetRowError } from "@/adapters/persistence/sqlite/repositories/quiz-set.mapper";
import { createSqliteQuizSetRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-set.repository";
import { createSqliteTransaction } from "@/adapters/persistence/sqlite/sqlite-transaction";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import { QuestionType } from "@/domain/quiz-set/question";
import {
	addQuestions,
	archiveQuizSet,
	publishQuizSet,
	type QuizSet,
	QuizSetStatus,
	toQuizSetId,
} from "@/domain/quiz-set/quiz-set";
import { anOption, aQuestion, aQuizSet } from "../../fixtures/quiz-set.fixture";
import {
	countRows,
	insertQuestionResponse,
	insertQuizAttempt,
	openMigratedDatabase,
} from "./migrated-database";

let database: Database;
let repository: QuizSetRepository;

beforeEach(() => {
	database = openMigratedDatabase();
	repository = createSqliteQuizSetRepository(
		createDrizzleClient(database),
		createSqliteTransaction(createDrizzleClient(database)),
	);
});

afterEach(() => {
	database.close();
});

const publishedSet = (): QuizSet =>
	publishQuizSet(
		aQuizSet({ questions: [aQuestion({ id: "question-1" })] }),
		new Date("2026-08-02T00:00:00.000Z"),
	);

const idsOf = (
	values: readonly { readonly id: string }[] = [],
): readonly string[] => values.map((value) => value.id);

describe("SqliteQuizSetRepository", () => {
	describe("save and findById", () => {
		test("round-trips a draft with its questions, options and tags", () => {
			const quizSet = aQuizSet({
				tags: ["bun", "sqlite"],
				description: "Persistence drills",
				source: "Designing Data-Intensive Applications",
				sourceChapters: "1-3",
				questions: [
					aQuestion({
						id: "question-1",
						topic: "Persistence",
						explanation: "Because durability matters.",
						hint: "Think about fsync.",
						sourceReference: "p. 12",
					}),
					aQuestion({
						id: "question-2",
						type: QuestionType.MultipleChoice,
						position: 1,
					}),
				],
			});

			repository.save(quizSet);

			expect(repository.findById(quizSet.id)).toEqual(quizSet);
		});

		test("preserves question order, option order and correctness flags", () => {
			const quizSet = aQuizSet({
				questions: [
					aQuestion({ id: "question-1" }),
					aQuestion({ id: "question-2", position: 1 }),
				],
			});

			repository.save(quizSet);
			const stored = repository.findById(quizSet.id);

			expect(idsOf(stored?.questions)).toEqual(["question-1", "question-2"]);
			expect(idsOf(stored?.questions[0]?.options)).toEqual([
				"question-1-a",
				"question-1-b",
			]);
			expect(
				stored?.questions[0]?.options.map((option) => option.isCorrect),
			).toEqual([true, false]);
		});

		test("preserves optional fields that were never provided", () => {
			const quizSet = aQuizSet({
				questions: [aQuestion({ id: "question-1" })],
			});

			repository.save(quizSet);
			const stored = repository.findById(quizSet.id);

			expect(stored?.description).toBeUndefined();
			expect(stored?.source).toBeUndefined();
			expect(stored?.sourceChapters).toBeUndefined();
			expect(stored?.publishedAt).toBeUndefined();
			expect(stored?.archivedAt).toBeUndefined();
			expect(stored?.questions[0]?.explanation).toBeUndefined();
			expect(stored?.questions[0]?.sourceReference).toBeUndefined();
			expect(stored?.questions[0]?.topic).toBeUndefined();
			expect(stored?.questions[0]?.hint).toBeUndefined();
		});

		test("round-trips a published set with its publishedAt timestamp", () => {
			const quizSet = publishedSet();

			repository.save(quizSet);
			const stored = repository.findById(quizSet.id);

			expect(stored?.status).toBe(QuizSetStatus.Published);
			expect(stored?.publishedAt?.toISOString()).toBe(
				"2026-08-02T00:00:00.000Z",
			);
			expect(stored).toEqual(quizSet);
		});
	});

	describe("findById", () => {
		test("returns undefined for an unknown id", () => {
			expect(repository.findById(toQuizSetId("missing"))).toBeUndefined();
		});
	});

	describe("save", () => {
		test("saving the same aggregate twice does not duplicate questions", () => {
			const quizSet = aQuizSet({
				questions: [
					aQuestion({ id: "question-1" }),
					aQuestion({ id: "question-2", position: 1 }),
				],
			});

			repository.save(quizSet);
			repository.save(quizSet);

			expect(repository.findById(quizSet.id)?.questions).toHaveLength(2);
			expect(repository.list()[0]?.questionCount).toBe(2);
		});

		test("an appended question replaces the question set rather than appending twice", () => {
			const quizSet = aQuizSet({
				questions: [aQuestion({ id: "question-1" })],
			});
			repository.save(quizSet);

			const updated = addQuestions(
				quizSet,
				[aQuestion({ id: "question-2", position: 1 })],
				new Date("2026-08-02T00:00:00.000Z"),
			);
			repository.save(updated);

			const stored = repository.findById(quizSet.id);

			expect(idsOf(stored?.questions)).toEqual(["question-1", "question-2"]);
			expect(countRows(database, "questions")).toBe(2);
		});

		test("a failure inside the transaction leaves the stored version unchanged", () => {
			const quizSet = aQuizSet({
				questions: [aQuestion({ id: "question-1" })],
			});
			repository.save(quizSet);

			const duplicateFingerprint = aQuestion({
				id: "question-2",
				prompt: "Prompt for question-1",
				position: 1,
				options: [
					anOption({
						id: "question-2-a",
						text: "Correct answer for question-1",
						isCorrect: true,
						position: 0,
					}),
					anOption({
						id: "question-2-b",
						text: "Wrong answer for question-1",
						isCorrect: false,
						position: 1,
					}),
				],
			});
			const corrupted: QuizSet = {
				...quizSet,
				questions: [...quizSet.questions, duplicateFingerprint],
				updatedAt: new Date("2026-08-02T00:00:00.000Z"),
			};

			expect(() => {
				repository.save(corrupted);
			}).toThrow();
			expect(repository.findById(quizSet.id)).toEqual(quizSet);
		});

		test("persists a question inserted in the middle of the set", () => {
			const first = aQuestion({ id: "question-a" });
			const last = aQuestion({ id: "question-b", position: 1 });
			const quizSet = aQuizSet({ questions: [first, last] });
			repository.save(quizSet);

			repository.save({
				...quizSet,
				questions: [
					first,
					aQuestion({ id: "question-c", position: 1 }),
					{ ...last, position: 2 },
				],
				updatedAt: new Date("2026-08-02T00:00:00.000Z"),
			});

			expect(idsOf(repository.findById(quizSet.id)?.questions)).toEqual([
				"question-a",
				"question-c",
				"question-b",
			]);
		});

		test("persists a reordering of the existing questions", () => {
			const first = aQuestion({ id: "question-a" });
			const second = aQuestion({ id: "question-b", position: 1 });
			const quizSet = aQuizSet({ questions: [first, second] });
			repository.save(quizSet);

			repository.save({
				...quizSet,
				questions: [
					{ ...second, position: 0 },
					{ ...first, position: 1 },
				],
				updatedAt: new Date("2026-08-02T00:00:00.000Z"),
			});

			expect(idsOf(repository.findById(quizSet.id)?.questions)).toEqual([
				"question-b",
				"question-a",
			]);
		});

		test("keeps recorded attempt responses when the set is saved again", () => {
			const quizSet = publishedSet();
			repository.save(quizSet);
			insertQuizAttempt(database, { id: "attempt-1", quizSetId: quizSet.id });
			insertQuestionResponse(database, {
				attemptId: "attempt-1",
				questionId: "question-1",
			});

			repository.save(
				archiveQuizSet(quizSet, new Date("2026-08-03T00:00:00.000Z")),
			);

			expect(countRows(database, "question_responses")).toBe(1);
		});
	});

	describe("list", () => {
		test("returns an empty array for an empty database", () => {
			expect(repository.list()).toEqual([]);
		});

		test("returns summaries newest-first with the correct question count", () => {
			seedThreeSets();

			expect(
				repository
					.list()
					.map((summary) => `${summary.id}:${summary.status}` as string),
			).toEqual([
				`set-archived:${QuizSetStatus.Archived}`,
				`set-published:${QuizSetStatus.Published}`,
				`set-draft:${QuizSetStatus.Draft}`,
			]);
			expect(repository.list()[0]?.questionCount).toBe(1);
			expect(repository.list()[0]?.updatedAt.toISOString()).toBe(
				"2026-08-05T00:00:00.000Z",
			);
		});

		test("filtering by published excludes drafts and archived sets", () => {
			seedThreeSets();

			expect(
				repository
					.list({ statuses: [QuizSetStatus.Published] })
					.map((summary) => summary.id as string),
			).toEqual(["set-published"]);
		});

		test("an empty status filter matches nothing", () => {
			seedThreeSets();

			expect(repository.list({ statuses: [] })).toEqual([]);
		});
	});

	describe("corrupted rows", () => {
		const corrupt = (column: string, value: string | null): void => {
			database.run(`UPDATE quiz_sets SET ${column} = ? WHERE id = 'set-1'`, [
				value,
			]);
		};

		beforeEach(() => {
			repository.save(publishedSet());
		});

		test("rejects a published set whose publishedAt was lost", () => {
			corrupt("published_at", null);

			expect(() => repository.findById(toQuizSetId("set-1"))).toThrow(
				CorruptedQuizSetRowError,
			);
		});

		test("rejects an archived set whose archivedAt was lost", () => {
			corrupt("status", QuizSetStatus.Archived);

			expect(() => repository.findById(toQuizSetId("set-1"))).toThrow(
				CorruptedQuizSetRowError,
			);
		});

		test("rejects a blank title", () => {
			corrupt("title", "   ");

			expect(() => repository.findById(toQuizSetId("set-1"))).toThrow(
				CorruptedQuizSetRowError,
			);
		});

		test("rejects a blank language", () => {
			corrupt("language", "");

			expect(() => repository.findById(toQuizSetId("set-1"))).toThrow(
				CorruptedQuizSetRowError,
			);
		});

		test("rejects tags that are not a JSON array of strings", () => {
			corrupt("tags", "not json");

			expect(() => repository.findById(toQuizSetId("set-1"))).toThrow(
				CorruptedQuizSetRowError,
			);

			corrupt("tags", '["ok", 7]');

			expect(() => repository.findById(toQuizSetId("set-1"))).toThrow(
				CorruptedQuizSetRowError,
			);
		});

		test("rejects an unparsable timestamp", () => {
			corrupt("created_at", "nonsense");

			expect(() => repository.findById(toQuizSetId("set-1"))).toThrow(
				CorruptedQuizSetRowError,
			);
		});

		test("rejects a question whose options vanished", () => {
			database.run("DELETE FROM question_options");

			expect(() => repository.findById(toQuizSetId("set-1"))).toThrow();
		});
	});
});

function seedThreeSets(): void {
	repository.save(
		aQuizSet({
			id: "set-draft",
			createdAt: new Date("2026-08-01T00:00:00.000Z"),
			questions: [aQuestion({ id: "question-draft" })],
		}),
	);
	repository.save(
		publishQuizSet(
			aQuizSet({
				id: "set-published",
				createdAt: new Date("2026-08-02T00:00:00.000Z"),
				questions: [aQuestion({ id: "question-published" })],
			}),
			new Date("2026-08-03T00:00:00.000Z"),
		),
	);
	repository.save(
		archiveQuizSet(
			aQuizSet({
				id: "set-archived",
				createdAt: new Date("2026-08-04T00:00:00.000Z"),
				questions: [aQuestion({ id: "question-archived" })],
			}),
			new Date("2026-08-05T00:00:00.000Z"),
		),
	);
}
