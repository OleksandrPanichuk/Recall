import { describe, expect, test } from "bun:test";
import type { CurrentQuestionView } from "@recall/contracts";
import { quizCallToAction } from "@/features/statistics/lib/quiz-page";

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
