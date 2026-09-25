import { afterEach, describe, expect, test } from "bun:test";
import type { CurrentQuestionView } from "@recall/contracts";
import { QuestionType } from "@recall/contracts";
import { createContext, type ReactNode, useContext } from "react";

const { cleanup, render, screen } = await import("@testing-library/react");
const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } =
	await import("@tanstack/react-router");
const { PracticeView } = await import(
	"@/features/practice/ui/views/PracticeView"
);
const { Route: PracticeRoute } = await import("@/routes/practice.$quizId");
const { Route: QuizRoute } = await import("@/routes/quizzes.$quizId");
const { Route: EditRoute } = await import("@/routes/quizzes.$quizId_.edit");

afterEach(() => {
	cleanup();
});

const Started = createContext<CurrentQuestionView | null>(null);

const attempt = (attemptId: string, prompt: string): CurrentQuestionView => ({
	attemptId,
	quizSetId: `quiz-${attemptId}`,
	quizSetTitle: "A set",
	status: "active",
	question: {
		id: `question-${attemptId}`,
		type: QuestionType.SingleChoice,
		prompt,
		options: [
			{
				id: `option-${attemptId}`,
				text: "Only",
				isCorrect: true,
				position: 0,
				matchKey: undefined,
			},
		],
		difficulty: "medium",
		position: 0,
	},
	index: 0,
	total: 1,
	awaitingFinish: false,
	shuffleOptions: false,
	examMode: false,
});

function Screen() {
	const started = useContext(Started);

	return (
		<PracticeView
			quizId={started?.quizSetId ?? "quiz"}
			started={started}
			blockedBy={null}
			nothing={null}
			signedIn
		/>
	);
}

const router = createRouter({
	routeTree: createRootRoute({ component: Screen }),
	history: createMemoryHistory({ initialEntries: ["/"] }),
});

const showing = (started: CurrentQuestionView): ReactNode => (
	<Started.Provider value={started}>
		<RouterProvider router={router} />
	</Started.Provider>
);

describe("practice after the route hands it a new attempt", () => {
	test("shows the new attempt, not the one it was showing", async () => {
		const { rerender } = render(showing(attempt("first", "First prompt")));

		expect(await screen.findByText("First prompt")).toBeDefined();

		rerender(showing(attempt("second", "Second prompt")));

		expect(await screen.findByText("Second prompt")).toBeDefined();
		expect(screen.queryByText("First prompt")).toBeNull();
	});
});

type Remount = (options: {
	params: { quizId: string };
	loaderDeps: { mode?: string };
}) => unknown;

const key = (route: { options: { remountDeps?: unknown } }) =>
	route.options.remountDeps as Remount;

describe("which navigations start a fresh screen", () => {
	test("practice remounts for another set and for another mode of the same set", () => {
		const remount = key(PracticeRoute);
		const due = remount({
			params: { quizId: "a" },
			loaderDeps: { mode: "due" },
		});

		expect(
			remount({ params: { quizId: "b" }, loaderDeps: { mode: "due" } }),
		).not.toEqual(due);
		expect(
			remount({ params: { quizId: "a" }, loaderDeps: { mode: "mistakes" } }),
		).not.toEqual(due);
		expect(
			remount({ params: { quizId: "a" }, loaderDeps: { mode: "due" } }),
		).toEqual(due);
	});

	test("the quiz screen and its editor remount for another quiz", () => {
		for (const route of [QuizRoute, EditRoute]) {
			const remount = key(route);
			const a = remount({ params: { quizId: "a" }, loaderDeps: {} });

			expect(remount({ params: { quizId: "b" }, loaderDeps: {} })).not.toEqual(
				a,
			);
			expect(remount({ params: { quizId: "a" }, loaderDeps: {} })).toEqual(a);
		}
	});
});
