import { afterEach, describe, expect, test } from "bun:test";
import type { DueSet, FinishQuizAttemptResult } from "@recall/contracts";
import type { ReactNode } from "react";
import type { FinishedAttempt } from "@/features/practice/lib/practice.types";

const { cleanup, render, screen } = await import("@testing-library/react");
const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } =
	await import("@tanstack/react-router");
const { finishedWith, nextDueAfter } = await import(
	"@/features/practice/lib/next-due"
);
const { AttemptFinished } = await import(
	"@/features/practice/ui/components/AttemptFinished"
);
const { NothingToPractice } = await import(
	"@/features/practice/ui/components/NothingToPractice"
);
const { DueList } = await import("@/features/review/ui/components/DueList");
const { ReviewView } = await import("@/features/review/ui/views/ReviewView");

afterEach(() => {
	cleanup();
});

const routed = (node: ReactNode) =>
	render(
		<RouterProvider
			router={createRouter({
				routeTree: createRootRoute({ component: () => node }),
				history: createMemoryHistory({ initialEntries: ["/"] }),
			})}
		/>,
	);

const dueSet = (
	quizSetId: string,
	title: string,
	dueCount: number,
): DueSet => ({
	quizSetId,
	title,
	dueCount,
	overdueDays: 0,
	dueQuestionIds: Array.from(
		{ length: dueCount },
		(_, i) => `${quizSetId}-q${i}`,
	),
});

const finished = (nextDue: DueSet | null): FinishedAttempt => ({
	attemptId: "attempt-1",
	mode: "full",
	correct: 4,
	total: 5,
	percentage: 80,
	scheduled: [],
	nextDue,
});

describe("picking the next due set after a finished one", () => {
	test("skips the set that was just finished and takes the first other one", () => {
		const a = dueSet("set-a", "A", 2);
		const b = dueSet("set-b", "B", 3);
		const due = [a, b, dueSet("set-c", "C", 1)];

		expect(nextDueAfter(due, "set-a")).toEqual(b);
		expect(nextDueAfter(due, "set-b")).toEqual(a);
	});

	test("is null when only the finished set is due, or nothing is", () => {
		expect(nextDueAfter([dueSet("set-a", "A", 2)], "set-a")).toBeNull();
		expect(nextDueAfter([], "set-a")).toBeNull();
	});
});

describe("finishing and then looking for the next due set", () => {
	const result: FinishQuizAttemptResult = {
		attemptId: "attempt-1",
		quizSetId: "set-a",
		mode: "full",
		score: { correct: 4, total: 5, percentage: 80 },
		unansweredCount: 0,
		scheduled: [],
	};

	test("carries the finish and the first other due set", async () => {
		const b = dueSet("set-b", "B", 3);

		expect(
			await finishedWith(
				() => Promise.resolve(result),
				() => Promise.resolve([dueSet("set-a", "A", 1), b]),
			),
		).toEqual({ result, nextDue: b });
	});

	test("a failed due lookup leaves the finish intact with no next set", async () => {
		expect(
			await finishedWith(
				() => Promise.resolve(result),
				() => Promise.reject(new Error("api restarting")),
			),
		).toEqual({ result, nextDue: null });
	});

	test("a failed finish is still a failure", async () => {
		const failed = finishedWith(
			() => Promise.reject(new Error("NoActiveAttemptError")),
			() => Promise.resolve([]),
		);

		await expect(failed).rejects.toThrow("NoActiveAttemptError");
	});
});

describe("the finished screen in a review chain", () => {
	test("offers the next due set first when there is one", async () => {
		routed(
			<AttemptFinished
				finished={finished(dueSet("set-b", "Verbs", 3))}
				quizId="set-a"
				mode="due"
			/>,
		);

		const next = (await screen.findByText("Next: Verbs (3 due)")).closest("a");

		expect(next?.getAttribute("href")).toBe("/practice/set-b?mode=due");
		expect(screen.queryByText("That was everything due today.")).toBeNull();
		expect(screen.queryByText("Retry the ones you missed")).not.toBeNull();
		expect(screen.queryByText("Go through the answers")).not.toBeNull();

		const links = screen.getAllByRole("link").map((b) => b.textContent);

		expect(links.indexOf("Next: Verbs (3 due)")).toBeLessThan(
			links.indexOf("Retry the ones you missed"),
		);
	});

	test("says the review is over when the run was due-only and nothing else is due", async () => {
		routed(
			<AttemptFinished finished={finished(null)} quizId="set-a" mode="due" />,
		);

		expect(
			await screen.findByText("That was everything due today."),
		).toBeDefined();
		expect(screen.queryByText(/^Next:/)).toBeNull();
	});

	test("says nothing about the review after an ordinary attempt with nothing due", async () => {
		routed(<AttemptFinished finished={finished(null)} quizId="set-a" />);

		await screen.findByText("Go through the answers");

		expect(screen.queryByText("That was everything due today.")).toBeNull();
		expect(screen.queryByText(/^Next:/)).toBeNull();
	});

	test("still offers the next due set after an ordinary attempt", async () => {
		routed(
			<AttemptFinished
				finished={finished(dueSet("set-b", "Verbs", 1))}
				quizId="set-a"
			/>,
		);

		const next = (await screen.findByText("Next: Verbs (1 due)")).closest("a");

		expect(next?.getAttribute("href")).toBe("/practice/set-b?mode=due");
	});
});

describe("when a due-only attempt finds nothing due", () => {
	test("says so and points back at the review, not the quiz", async () => {
		routed(<NothingToPractice mode="due" quizId="set-a" />);

		expect(
			await screen.findByText("Nothing in this set is due right now."),
		).toBeDefined();

		const link = screen.getByText("Back to review").closest("a");

		expect(link?.getAttribute("href")).toBe("/review");
		expect(screen.queryByText("Back to quiz")).toBeNull();
	});
});

describe("the review screen", () => {
	test("each due row starts a due-only attempt", async () => {
		routed(<DueList due={[dueSet("set-a", "Nouns", 2)]} />);

		const row = (await screen.findByText("Nouns")).closest("a");

		expect(row?.getAttribute("href")).toBe("/practice/set-a?mode=due");
	});

	test("starts today's review at the most overdue set", async () => {
		routed(
			<ReviewView
				due={[dueSet("set-b", "Verbs", 3), dueSet("set-a", "Nouns", 2)]}
				leeches={[]}
				retired={[]}
				signedIn
			/>,
		);

		const start = (await screen.findByText("Start today's review")).closest(
			"a",
		);

		expect(start?.getAttribute("href")).toBe("/practice/set-b?mode=due");
	});

	test("has no review to start when nothing is due", async () => {
		routed(<ReviewView due={[]} leeches={[]} retired={[]} signedIn />);

		await screen.findByText("Nothing is due today.");

		expect(screen.queryByText("Start today's review")).toBeNull();
	});
});
