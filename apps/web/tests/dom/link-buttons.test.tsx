import { afterEach, describe, expect, test } from "bun:test";
import type { DueSet } from "@recall/contracts";
import type { ReactNode } from "react";
import type { FinishedAttempt } from "@/features/practice/lib/practice.types";

const { cleanup, render, screen } = await import("@testing-library/react");
const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } =
	await import("@tanstack/react-router");
const { Button } = await import("@/components/ui/Button");
const { ErrorPanel } = await import("@/shared/ui/components/ErrorPanel");
const { NotFound } = await import("@/shared/ui/components/NotFound");
const { SignInPrompt } = await import("@/shared/ui/components/SignInPrompt");
const { AttemptInProgress } = await import(
	"@/features/practice/ui/components/AttemptInProgress"
);
const { AttemptFinished } = await import(
	"@/features/practice/ui/components/AttemptFinished"
);
const { NothingToPractice } = await import(
	"@/features/practice/ui/components/NothingToPractice"
);
const { ReviewView } = await import("@/features/review/ui/views/ReviewView");
const { AttemptReviewView } = await import(
	"@/features/statistics/ui/views/AttemptReviewView"
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

const finished: FinishedAttempt = {
	attemptId: "attempt-1",
	mode: "full",
	correct: 3,
	total: 5,
	percentage: 60,
	scheduled: [],
	nextDue: null,
};

const due: DueSet = {
	quizSetId: "quiz-2",
	title: "Verbs",
	dueCount: 2,
	overdueDays: 0,
	dueQuestionIds: ["q1", "q2"],
};

const screens: readonly [string, string, () => ReactNode][] = [
	[
		"the error panel",
		"Back to library",
		() => <ErrorPanel error={new Error("x")} />,
	],
	["the not-found screen", "Back to library", () => <NotFound />],
	["the sign-in prompt", "Create account", () => <SignInPrompt />],
	[
		"the attempt already in progress",
		"Carry on with that one",
		() => (
			<AttemptInProgress
				title="Nouns"
				quizSetId="quiz-1"
				onAbandon={async () => undefined}
			/>
		),
	],
	[
		"the finished attempt",
		"Back to quiz",
		() => <AttemptFinished finished={finished} quizId="quiz-1" />,
	],
	[
		"the finished attempt with more due",
		"Retry the ones you missed",
		() => (
			<AttemptFinished
				finished={{ ...finished, nextDue: due }}
				quizId="quiz-1"
			/>
		),
	],
	[
		"the review screen",
		"Start today's review",
		() => <ReviewView due={[due]} leeches={[]} retired={[]} signedIn />,
	],
	[
		"nothing to practise",
		"Back to review",
		() => <NothingToPractice mode="due" quizId="quiz-1" />,
	],
];

describe("a link that looks like a button", () => {
	test("is one element, the anchor, styled as a button", () => {
		render(
			<Button asChild variant="outline">
				<a href="/somewhere">Go</a>
			</Button>,
		);

		const link = screen.getByRole("link", { name: "Go" });

		expect(link.tagName).toBe("A");
		expect(link.className).toContain("inline-flex");
		expect(screen.queryByRole("button")).toBeNull();
	});

	test("keeps its own spacing and the button look on the same anchor", async () => {
		routed(
			<AttemptReviewView
				attempt={{
					attemptId: "attempt-1",
					quizSetId: "quiz-1",
					quizSetTitle: "Nouns",
					score: { correct: 1, total: 2, percentage: 50 },
					answers: [],
				}}
			/>,
		);

		const link = (await screen.findByText("back to quiz")).closest("a");

		expect(link?.getAttribute("href")).toBe("/quizzes/quiz-1");
		expect(link?.className).toContain("mt-6");
		expect(link?.className).toContain("inline-flex");
		expect(link?.querySelector("button")).toBeNull();
	});

	for (const [name, label, node] of screens) {
		test(`never nests a button inside a link on ${name}`, async () => {
			const { container } = routed(node());

			const link = (await screen.findByText(label)).closest("a");

			expect(link).not.toBeNull();
			expect(container.querySelector("a button")).toBeNull();
			expect(container.querySelector("button a")).toBeNull();
		});
	}
});
