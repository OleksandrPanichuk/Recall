import { describe, expect, test } from "bun:test";
import type { CurrentQuestionView, QuizStatistics } from "@recall/contracts";
import {
	quizCallToAction,
	secondaryActions,
} from "@/features/statistics/lib/quiz-page";

const active = (over: Partial<CurrentQuestionView> = {}): CurrentQuestionView =>
	({
		attemptId: "attempt-1",
		quizSetId: "quiz-1",
		quizSetTitle: "Chapter 02",
		status: "active",
		index: 5,
		total: 26,
		awaitingFinish: false,
		shuffleOptions: false,
		examMode: false,
		...over,
	}) as CurrentQuestionView;

describe("what the quiz page offers", () => {
	test("invites a first run when nothing has happened", () => {
		expect(quizCallToAction(0, null)).toEqual({
			caption: "No attempts yet",
			label: "Start",
			resuming: false,
		});
	});

	test("offers another run once some are finished", () => {
		expect(quizCallToAction(2, null).label).toBe("Run it again");
	});

	test("offers to continue, not to start over, while an attempt is open", () => {
		const action = quizCallToAction(1, active());

		expect(action.label).toBe("Carry on");
		expect(action.resuming).toBe(true);
	});

	test("says how far in that attempt got, counting from one", () => {
		expect(quizCallToAction(1, active({ index: 5, total: 26 })).caption).toBe(
			"1 attempt · started, 6 of 26",
		);
	});

	test("says a paused attempt is paused, not merely started", () => {
		expect(
			quizCallToAction(1, active({ status: "paused", index: 5, total: 26 }))
				.caption,
		).toBe("1 attempt · paused at 6 of 26");
	});

	test("still offers to continue a paused attempt", () => {
		expect(quizCallToAction(1, active({ status: "paused" })).label).toBe(
			"Carry on",
		);
	});

	test("asks to finish when every question is behind you", () => {
		const action = quizCallToAction(1, active({ awaitingFinish: true }));

		expect(action.label).toBe("Finish attempt");
		expect(action.caption).toContain("waiting to be finished");
	});
});

const statistics = (
	over: Partial<Pick<QuizStatistics, "incorrectQuestionIds" | "topics">> = {},
): Pick<QuizStatistics, "incorrectQuestionIds" | "topics"> => ({
	incorrectQuestionIds: [],
	topics: [],
	...over,
});

describe("the other ways the quiz page offers to practise", () => {
	test("offers nothing when nothing went wrong and no topic is known", () => {
		expect(secondaryActions(statistics(), null)).toEqual([]);
	});

	test("offers to retry mistakes, and says how many there are", () => {
		expect(
			secondaryActions(
				statistics({ incorrectQuestionIds: ["q1", "q2", "q3"] }),
				null,
			),
		).toEqual([{ mode: "mistakes", label: "Retry mistakes (3)" }]);
	});

	test("offers weak topics once topics have been answered", () => {
		expect(
			secondaryActions(
				statistics({ topics: [{ topic: "Cells", answered: 4, correct: 1 }] }),
				null,
			),
		).toEqual([{ mode: "weak_topics", label: "Weak topics" }]);
	});

	test("lists mistakes before weak topics when both apply", () => {
		expect(
			secondaryActions(
				statistics({
					incorrectQuestionIds: ["q1"],
					topics: [{ topic: "Cells", answered: 4, correct: 1 }],
				}),
				null,
			).map((action) => action.mode),
		).toEqual(["mistakes", "weak_topics"]);
	});

	test("offers neither while an attempt is open", () => {
		expect(
			secondaryActions(
				statistics({
					incorrectQuestionIds: ["q1"],
					topics: [{ topic: "Cells", answered: 4, correct: 1 }],
				}),
				active(),
			),
		).toEqual([]);
	});
});
