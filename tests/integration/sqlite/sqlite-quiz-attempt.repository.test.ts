import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createSqliteQuizAttemptRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-attempt.repository";
import { createSqliteQuizSetRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-set.repository";
import { createSqliteTransaction } from "@/adapters/persistence/sqlite/sqlite-transaction";
import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import {
	completeQuizAttempt,
	pauseQuizAttempt,
	type QuizAttempt,
	QuizAttemptMode,
	recordResponse,
	toQuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import {
	anAnswer,
	anAttempt,
	answeredQuestionIdsOf,
} from "../../fixtures/quiz-attempt.fixture";
import { aQuestion, aQuizSet } from "../../fixtures/quiz-set.fixture";
import {
	countRows,
	insertQuestionResponse,
	openMigratedDatabase,
} from "./migrated-database";

const at = (iso: string): Date => new Date(iso);

const firstAnswerAt = at("2026-08-01T10:05:00.000Z");
const secondAnswerAt = at("2026-08-01T10:06:00.000Z");
const thirdAnswerAt = at("2026-08-01T10:07:00.000Z");

let database: Database;
let repository: QuizAttemptRepository;

const newRepository = (): QuizAttemptRepository =>
	createSqliteQuizAttemptRepository(
		database,
		createSqliteTransaction(database),
	);

function seedQuizSet(topics: Record<string, string | undefined> = {}): void {
	const questionIds = ["question-1", "question-2", "question-3"];
	createSqliteQuizSetRepository(
		database,
		createSqliteTransaction(database),
	).save(
		aQuizSet({
			questions: questionIds.map((id, position) =>
				aQuestion({ id, position, topic: topics[id] }),
			),
		}),
	);
}

beforeEach(() => {
	database = openMigratedDatabase();
	seedQuizSet();
	repository = newRepository();
});

afterEach(() => {
	database.close();
});

const threeQuestionAttempt = (): QuizAttempt =>
	anAttempt({ questionIds: ["question-1", "question-2", "question-3"] });

const answeredTwice = (): QuizAttempt =>
	recordResponse(
		recordResponse(
			threeQuestionAttempt(),
			anAnswer("question-1", true, firstAnswerAt),
		),
		anAnswer("question-2", false, secondAnswerAt),
	);

describe("SqliteQuizAttemptRepository", () => {
	describe("save and findById", () => {
		test("round-trips an active attempt with its responses in plan order", () => {
			const attempt = answeredTwice();

			repository.save(attempt);
			const stored = repository.findById(attempt.id);

			expect(stored).toEqual(attempt);
			expect(answeredQuestionIdsOf(stored as QuizAttempt)).toEqual([
				"question-1",
				"question-2",
			]);
		});

		test("round-trips an attempt that has not been answered yet", () => {
			const attempt = threeQuestionAttempt();

			repository.save(attempt);

			expect(repository.findById(attempt.id)).toEqual(attempt);
		});

		test("round-trips a completed attempt", () => {
			const attempt = completeQuizAttempt(answeredTwice(), thirdAnswerAt);

			repository.save(attempt);

			expect(repository.findById(attempt.id)).toEqual(attempt);
		});

		test("returns undefined for an unknown id", () => {
			expect(repository.findById(toQuizAttemptId("missing"))).toBeUndefined();
		});

		test("saving the same attempt twice keeps exactly two responses", () => {
			const attempt = answeredTwice();

			repository.save(attempt);
			repository.save(attempt);

			expect(repository.findById(attempt.id)?.responses).toHaveLength(2);
			expect(countRows(database, "question_responses")).toBe(2);
		});

		test("drops responses for questions the plan no longer contains", () => {
			repository.save(answeredTwice());

			const narrowed = recordResponse(
				anAttempt({ questionIds: ["question-3"] }),
				anAnswer("question-3", true, thirdAnswerAt),
			);
			repository.save(narrowed);

			expect(repository.findById(narrowed.id)).toEqual(narrowed);
			expect(countRows(database, "question_responses")).toBe(1);
		});

		test("ignores a stale write that would move the attempt backwards", () => {
			const attempt = answeredTwice();
			repository.save(attempt);

			repository.save(
				pauseQuizAttempt(
					recordResponse(
						threeQuestionAttempt(),
						anAnswer("question-1", true, firstAnswerAt),
					),
					at("2026-08-01T10:05:30.000Z"),
				),
			);

			expect(repository.findById(attempt.id)).toEqual(attempt);
		});

		test("saving an attempt again records the answer it gained", () => {
			const attempt = answeredTwice();
			repository.save(attempt);

			repository.save(
				recordResponse(attempt, anAnswer("question-3", true, thirdAnswerAt)),
			);

			expect(repository.findById(attempt.id)?.responses).toHaveLength(3);
		});
	});

	describe("findActiveByUser", () => {
		test("finds an active attempt", () => {
			const attempt = answeredTwice();
			repository.save(attempt);

			expect(repository.findActiveByUser(42)).toEqual(attempt);
		});

		test("finds a paused attempt through a new repository instance", () => {
			const paused = pauseQuizAttempt(answeredTwice(), thirdAnswerAt);
			repository.save(paused);

			expect(newRepository().findActiveByUser(42)).toEqual(paused);
		});

		test("returns undefined once the attempt is completed", () => {
			repository.save(completeQuizAttempt(answeredTwice(), thirdAnswerAt));

			expect(repository.findActiveByUser(42)).toBeUndefined();
		});

		test("returns undefined for a user with no attempts", () => {
			repository.save(answeredTwice());

			expect(repository.findActiveByUser(7)).toBeUndefined();
		});
	});

	describe("listCompletedBySet", () => {
		test("returns only completed attempts, oldest first, with their scores", () => {
			repository.save(answeredTwice());
			repository.save(
				completeQuizAttempt(
					recordResponse(
						anAttempt({
							id: "attempt-2",
							startedAt: at("2026-08-02T10:00:00.000Z"),
						}),
						anAnswer("question-1", true, at("2026-08-02T10:05:00.000Z")),
					),
					at("2026-08-02T10:06:00.000Z"),
				),
			);
			repository.save(
				completeQuizAttempt(
					recordResponse(
						anAttempt({
							id: "attempt-3",
							startedAt: at("2026-08-03T10:00:00.000Z"),
						}),
						anAnswer("question-1", false, at("2026-08-03T10:05:00.000Z")),
					),
					at("2026-08-03T10:06:00.000Z"),
				),
			);

			const statistics = repository.listCompletedBySet(
				42,
				toQuizSetId("set-1"),
			);

			expect(
				statistics.map((entry) => [
					entry.attemptId as string,
					entry.correct,
					entry.total,
				]),
			).toEqual([
				["attempt-2", 1, 2],
				["attempt-3", 0, 2],
			]);
			expect(statistics[0]?.completedAt?.toISOString()).toBe(
				"2026-08-02T10:06:00.000Z",
			);
		});

		test("returns an empty list when nothing is completed", () => {
			repository.save(answeredTwice());

			expect(repository.listCompletedBySet(42, toQuizSetId("set-1"))).toEqual(
				[],
			);
		});

		test("ignores another user's completed attempts", () => {
			repository.save(completeQuizAttempt(answeredTwice(), thirdAnswerAt));

			expect(repository.listCompletedBySet(7, toQuizSetId("set-1"))).toEqual(
				[],
			);
		});

		test("scores only the questions the plan contains", () => {
			repository.save(
				completeQuizAttempt(
					recordResponse(
						anAttempt({ questionIds: ["question-1"] }),
						anAnswer("question-1", true, firstAnswerAt),
					),
					secondAnswerAt,
				),
			);
			insertQuestionResponse(database, {
				attemptId: "attempt-1",
				questionId: "question-2",
				isCorrect: 1,
			});

			const [statistics] = repository.listCompletedBySet(
				42,
				toQuizSetId("set-1"),
			);

			expect([statistics?.correct, statistics?.total]).toEqual([1, 1]);
		});
	});

	describe("topicAccuracy", () => {
		test("groups by topic and reports an absent topic once", () => {
			seedQuizSet({ "question-1": "Alpha", "question-2": "Alpha" });

			repository.save(
				recordResponse(
					answeredTwice(),
					anAnswer("question-3", true, thirdAnswerAt),
				),
			);

			expect(
				repository
					.topicAccuracy(42)
					.map((entry) => [entry.topic, entry.answered, entry.correct]),
			).toEqual([
				["Alpha", 2, 1],
				[undefined, 1, 1],
			]);
		});

		test("returns an empty list for a user with no responses", () => {
			expect(repository.topicAccuracy(7)).toEqual([]);
		});
	});

	describe("incorrectQuestionIds", () => {
		test("returns a question answered incorrectly", () => {
			repository.save(answeredTwice());

			expect(repository.incorrectQuestionIds(42).map(String)).toEqual([
				"question-2",
			]);
		});

		test("omits a question a later attempt answered correctly", () => {
			repository.save(answeredTwice());
			repository.save(
				completeQuizAttempt(
					recordResponse(
						anAttempt({
							id: "attempt-2",
							mode: QuizAttemptMode.Mistakes,
							questionIds: ["question-2"],
							startedAt: at("2026-08-02T10:00:00.000Z"),
						}),
						anAnswer("question-2", true, at("2026-08-02T10:05:00.000Z")),
					),
					at("2026-08-02T10:06:00.000Z"),
				),
			);

			expect(repository.incorrectQuestionIds(42)).toEqual([]);
		});

		test("ignores another user's mistakes", () => {
			repository.save(answeredTwice());

			expect(repository.incorrectQuestionIds(7)).toEqual([]);
		});
	});

	describe("cascade", () => {
		test("deleting a quiz set removes its attempts and responses", () => {
			const attempt = answeredTwice();
			repository.save(attempt);

			database.run("DELETE FROM quiz_sets WHERE id = ?", ["set-1"]);

			expect(repository.findById(attempt.id)).toBeUndefined();
			expect(countRows(database, "quiz_attempts")).toBe(0);
			expect(countRows(database, "question_responses")).toBe(0);
		});
	});
});
