import { afterEach, describe, expect, test } from "bun:test";
import { useState } from "react";

const { cleanup, render, screen } = await import("@testing-library/react");
const {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} = await import("@tanstack/react-router");
const { Route: PracticeRoute } = await import("@/routes/practice.$quizId");

afterEach(() => {
	cleanup();
});

const routerLike = (gcTime: number | undefined) => {
	let answered = 0;
	const root = createRootRoute({ component: () => <Outlet /> });
	const practice = createRoute({
		getParentRoute: () => root,
		path: "/practice",
		gcTime,
		loader: () => ({ index: answered }),
		component: function Question() {
			const { index } = practice.useLoaderData();
			const [shown] = useState(index);

			return <p>Question {shown + 1}</p>;
		},
	});
	const quiz = createRoute({
		getParentRoute: () => root,
		path: "/quiz",
		component: () => <p>Quiz page</p>,
	});
	const router = createRouter({
		routeTree: root.addChildren([practice, quiz]),
		history: createMemoryHistory({ initialEntries: ["/practice"] }),
	});

	return { router, answer: () => (answered += 1) };
};

describe("coming back to an attempt", () => {
	test("shows the question the server says is next, not the one from the first visit", async () => {
		const { router, answer } = routerLike(PracticeRoute.options.gcTime);

		render(<RouterProvider router={router} />);
		expect(await screen.findByText("Question 1")).toBeDefined();

		answer();
		answer();
		router.history.push("/quiz");
		expect(await screen.findByText("Quiz page")).toBeDefined();
		router.history.push("/practice");

		expect(await screen.findByText("Question 3")).toBeDefined();
		expect(screen.queryByText("Question 1")).toBeNull();
	});
});
