import { afterEach, describe, expect, test } from "bun:test";
import type { LeechView, RetiredView } from "@recall/contracts";
import type { ReactNode } from "react";

const { cleanup, render, screen } = await import("@testing-library/react");
const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } =
	await import("@tanstack/react-router");
const { LeechList } = await import("@/features/review/ui/components/LeechList");
const { RetiredList } = await import(
	"@/features/review/ui/components/RetiredList"
);
const { retiredLabel } = await import(
	"@/features/review/ui/components/RetiredList/RetiredList.lib"
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

const leech = (questionId: string, prompt: string): LeechView => ({
	questionId,
	quizSetId: "set-a",
	quizSetTitle: "Nouns",
	prompt,
	lapses: 6,
});

const retired = (questionId: string, prompt: string): RetiredView => ({
	questionId,
	quizSetId: "set-a",
	quizSetTitle: "Nouns",
	prompt,
	retiredAt: "2026-09-17T09:00:00.000Z",
});

describe("the stuck list", () => {
	test("offers to retire every question it lists", async () => {
		routed(
			<LeechList leeches={[leech("q1", "der Zug"), leech("q2", "die")]} />,
		);

		await screen.findByText("der Zug");

		expect(screen.getAllByText("Retire")).toHaveLength(2);
	});

	test("counts lapses in the singular when there is one", async () => {
		routed(<LeechList leeches={[{ ...leech("q1", "der Zug"), lapses: 1 }]} />);

		const row = await screen.findByText("der Zug");

		expect(row.parentElement?.textContent).toContain("· 1 lapse");
	});

	test("says nothing is stuck rather than showing an empty card", async () => {
		routed(<LeechList leeches={[]} />);

		await screen.findByText("Nothing is stuck. Keep it up.");

		expect(screen.queryByText("Retire")).toBeNull();
	});
});

describe("the retired list", () => {
	test("offers to bring every retired question back", async () => {
		routed(
			<RetiredList
				retired={[retired("q1", "der Zug")]}
				today={new Date("2026-09-19T09:00:00.000Z")}
			/>,
		);

		await screen.findByText("der Zug");
		await screen.findByText("Bring back");
	});

	test("points at the stuck list when nothing is retired", async () => {
		routed(<RetiredList retired={[]} today={new Date()} />);

		await screen.findByText(/Nothing is retired/);
	});
});

describe("how long ago a question was retired", () => {
	const today = new Date("2026-09-19T12:00:00.000Z");

	test("names today and yesterday rather than counting", () => {
		expect(retiredLabel("2026-09-19T01:00:00.000Z", today)).toBe(
			"retired today",
		);
		expect(retiredLabel("2026-09-18T23:00:00.000Z", today)).toBe(
			"retired yesterday",
		);
	});

	test("counts whole days further back", () => {
		expect(retiredLabel("2026-09-15T08:00:00.000Z", today)).toBe(
			"retired 4 days ago",
		);
	});

	test("never reads as a future date", () => {
		expect(retiredLabel("2026-09-25T08:00:00.000Z", today)).toBe(
			"retired today",
		);
	});
});
