import { afterEach, describe, expect, test } from "bun:test";
import type { ReactNode } from "react";
import type { FinishedAttempt } from "@/features/practice/lib/practice.types";

const { cleanup, render, screen } = await import("@testing-library/react");
const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } =
	await import("@tanstack/react-router");
const { NothingToPractice } = await import(
	"@/features/practice/ui/components/NothingToPractice"
);
const { AttemptFinished } = await import(
	"@/features/practice/ui/components/AttemptFinished"
);

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

const finished = (correct: number, total: number): FinishedAttempt => ({
	attemptId: "attempt-1",
	mode: "full",
	correct,
	total,
	percentage: Math.round((correct / total) * 100),
	scheduled: [],
});

describe("when a mode has nothing to offer", () => {
	test("mistakes mode says every mistake has been corrected", async () => {
		routed(<NothingToPractice mode="mistakes" quizId="quiz-1" />);

		expect(
			await screen.findByText(
				"Nothing to retry — every question you got wrong has since been answered right.",
			),
		).toBeDefined();
	});

	test("weak-topics mode explains the thresholds with the real numbers", async () => {
		routed(<NothingToPractice mode="weak_topics" quizId="quiz-1" />);

		expect(
			await screen.findByText(
				"No weak topics yet. A topic counts as weak once it has at least 3 answers and fewer than 70% of them are right. Questions without a topic never qualify.",
			),
		).toBeDefined();
	});

	test("links back to the quiz", async () => {
		routed(<NothingToPractice mode="mistakes" quizId="quiz-1" />);

		const link = (await screen.findByText("Back to quiz")).closest("a");

		expect(link?.getAttribute("href")).toBe("/quizzes/quiz-1");
	});
});

describe("the finished screen and the ones that were missed", () => {
	test("offers to retry the missed ones after an imperfect score", async () => {
		routed(<AttemptFinished finished={finished(3, 5)} quizId="quiz-1" />);

		const link = (await screen.findByText("Retry the ones you missed")).closest(
			"a",
		);

		expect(link?.getAttribute("href")).toBe("/practice/quiz-1?mode=mistakes");
		expect(screen.queryByText("Go through the answers")).not.toBeNull();
		expect(screen.queryByText("Back to quiz")).not.toBeNull();
	});

	test("offers no retry after a perfect score", async () => {
		routed(<AttemptFinished finished={finished(5, 5)} quizId="quiz-1" />);

		await screen.findByText("Go through the answers");

		expect(screen.queryByText("Retry the ones you missed")).toBeNull();
	});
});
