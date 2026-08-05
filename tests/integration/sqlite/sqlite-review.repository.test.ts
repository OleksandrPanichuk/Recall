import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createSqliteQuizSetRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-set.repository";
import { createSqliteReviewRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-review.repository";
import { createSqliteTransaction } from "@/adapters/persistence/sqlite/sqlite-transaction";
import type { ReviewRepository } from "@/application/ports/repositories/review.repository";
import { toQuestionId } from "@/domain/quiz-set/question";
import {
	markReviewFailed,
	markReviewPassed,
	RETIREMENT_STREAK,
	type ReviewItem,
	ReviewItemState,
} from "@/domain/review/review-item";
import { aQuestion, aQuizSet } from "../../fixtures/quiz-set.fixture";
import { aReviewItem } from "../../fixtures/review-item.fixture";
import { countRows, openMigratedDatabase } from "./migrated-database";

const at = (iso: string): Date => new Date(iso);

const now = at("2026-08-10T00:00:00.000Z");
const reviewedAt = at("2026-08-03T00:00:00.000Z");

let database: Database;
let repository: ReviewRepository;

function seedQuizSet(): void {
	createSqliteQuizSetRepository(
		database,
		createSqliteTransaction(database),
	).save(
		aQuizSet({
			questions: ["question-1", "question-2", "question-3"].map(
				(id, position) => aQuestion({ id, position }),
			),
		}),
	);
}

beforeEach(() => {
	database = openMigratedDatabase();
	seedQuizSet();
	repository = createSqliteReviewRepository(
		database,
		createSqliteTransaction(database),
	);
});

afterEach(() => {
	database.close();
});

const retired = (item: ReviewItem): ReviewItem => {
	let retiring = item;

	for (let pass = 0; pass < RETIREMENT_STREAK; pass += 1) {
		retiring = markReviewPassed(
			retiring,
			reviewedAt,
			at("2026-08-04T00:00:00.000Z"),
		);
	}

	return retiring;
};

describe("SqliteReviewRepository", () => {
	describe("save and findByQuestion", () => {
		test("round-trips a pending item with no review yet", () => {
			const item = aReviewItem();

			repository.save(item);
			const stored = repository.findByQuestion(42, toQuestionId("question-1"));

			expect(stored).toEqual(item);
			expect(stored?.lastReviewedAt).toBeUndefined();
		});

		test("round-trips a reviewed item", () => {
			const item = markReviewPassed(
				aReviewItem(),
				reviewedAt,
				at("2026-08-06T00:00:00.000Z"),
			);

			repository.save(item);

			expect(repository.findByQuestion(42, toQuestionId("question-1"))).toEqual(
				item,
			);
		});

		test("saving twice keeps one row and applies the newer state", () => {
			const item = aReviewItem();
			repository.save(item);

			repository.save(
				markReviewPassed(item, reviewedAt, at("2026-08-06T00:00:00.000Z")),
			);

			const stored = repository.findByQuestion(42, toQuestionId("question-1"));

			expect(countRows(database, "review_items")).toBe(1);
			expect(stored?.state).toBe(ReviewItemState.Learning);
			expect(stored?.streak).toBe(1);
		});

		test("a second item for the same question never creates a duplicate", () => {
			repository.save(aReviewItem());

			repository.save(aReviewItem({ id: "review-duplicate" }));

			expect(countRows(database, "review_items")).toBe(1);
		});

		test("returns undefined for a question with no review item", () => {
			expect(
				repository.findByQuestion(42, toQuestionId("question-2")),
			).toBeUndefined();
		});

		test("scopes by telegram user id", () => {
			repository.save(aReviewItem());

			expect(
				repository.findByQuestion(7, toQuestionId("question-1")),
			).toBeUndefined();
		});
	});

	describe("listDue", () => {
		const seedThree = (): void => {
			repository.save(
				aReviewItem({
					questionId: "question-2",
					dueAt: at("2026-08-05T00:00:00.000Z"),
				}),
			);
			repository.save(
				aReviewItem({
					questionId: "question-1",
					dueAt: at("2026-08-03T00:00:00.000Z"),
				}),
			);
			repository.save(
				aReviewItem({
					questionId: "question-3",
					dueAt: at("2026-08-20T00:00:00.000Z"),
				}),
			);
		};

		test("returns due items oldest first and excludes future ones", () => {
			seedThree();

			expect(
				repository.listDue(42, now, 10).map((item) => String(item.questionId)),
			).toEqual(["question-1", "question-2"]);
		});

		test("honours the limit", () => {
			seedThree();

			expect(repository.listDue(42, now, 1)).toHaveLength(1);
		});

		test("excludes retired items", () => {
			repository.save(retired(aReviewItem()));

			expect(repository.listDue(42, now, 10)).toEqual([]);
		});

		test("scopes by telegram user id", () => {
			seedThree();

			expect(repository.listDue(7, now, 10)).toEqual([]);
		});

		test.each([0, -1, 1.5, Number.NaN])("rejects the limit %p", (limit) => {
			expect(() => repository.listDue(42, now, limit)).toThrow(RangeError);
		});
	});

	describe("countPending", () => {
		test("counts items that are not retired", () => {
			repository.save(aReviewItem({ questionId: "question-1" }));
			repository.save(
				markReviewPassed(
					aReviewItem({ questionId: "question-2" }),
					reviewedAt,
					at("2026-08-06T00:00:00.000Z"),
				),
			);
			repository.save(retired(aReviewItem({ questionId: "question-3" })));

			expect(repository.countPending(42)).toBe(2);
		});

		test("counts items that are not yet due", () => {
			repository.save(aReviewItem({ dueAt: at("2026-08-20T00:00:00.000Z") }));

			expect(repository.countPending(42)).toBe(1);
		});

		test("counts a failed review as outstanding", () => {
			repository.save(
				markReviewFailed(
					aReviewItem(),
					reviewedAt,
					at("2026-08-06T00:00:00.000Z"),
				),
			);

			expect(repository.countPending(42)).toBe(1);
		});

		test("scopes by telegram user id", () => {
			repository.save(aReviewItem());

			expect(repository.countPending(7)).toBe(0);
		});
	});

	describe("cascade", () => {
		test("deleting the question removes its review item", () => {
			repository.save(aReviewItem());

			database.run("DELETE FROM questions WHERE id = ?", ["question-1"]);

			expect(
				repository.findByQuestion(42, toQuestionId("question-1")),
			).toBeUndefined();
			expect(countRows(database, "review_items")).toBe(0);
		});
	});
});
