import { afterEach, describe, expect, test } from "bun:test";
import type { BrowseView } from "@recall/contracts";

const { cleanup, render, screen } = await import("@testing-library/react");
const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } =
	await import("@tanstack/react-router");
const { PageView } = await import("@/components/PageView");

const show = (view: BrowseView) => {
	const rootRoute = createRootRoute({
		component: () => <PageView view={view} />,
	});

	return render(
		<RouterProvider
			router={createRouter({
				routeTree: rootRoute,
				history: createMemoryHistory({ initialEntries: ["/"] }),
			})}
		/>,
	);
};

afterEach(() => {
	cleanup();
});

const aView = (over: Partial<BrowseView> = {}): BrowseView => ({
	folderId: "folder-1",
	name: "Chapter 1",
	summary: undefined,
	icon: undefined,
	parentId: undefined,
	breadcrumb: [],
	children: [],
	sets: [],
	attached: [],
	...over,
});

const aQuiz = (id: string, title: string) => ({
	id,
	title,
	status: "published" as const,
	questionCount: 1,
	updatedAt: "2026-08-20T00:00:00.000Z",
});

describe("a page with a summary", () => {
	test("renders the markdown as headings and lists", async () => {
		show(aView({ summary: "# Cells\n\n- membrane\n- nucleus" }));

		expect(await screen.findByRole("heading", { name: "Cells" })).toBeDefined();
		expect(
			(await screen.findAllByRole("listitem")).map((item) => item.textContent),
		).toEqual(["membrane", "nucleus"]);
	});

	test("links the pages and quizzes filed under it", async () => {
		show(
			aView({
				summary: "Matter and its changes.",
				children: [{ id: "folder-2", name: "Bonds", itemCount: 0 }],
				sets: [aQuiz("quiz-1", "Periodic table")],
			}),
		);

		expect(await screen.findByText("Bonds")).toBeDefined();
		expect(await screen.findByText("Periodic table")).toBeDefined();
	});

	test("lists a quiz that is only shown here, alongside the filed ones", async () => {
		show(
			aView({
				sets: [aQuiz("quiz-1", "Filed here")],
				attached: [
					aQuiz("quiz-1", "Filed here"),
					aQuiz("quiz-2", "Shown here"),
				],
			}),
		);

		expect(await screen.findByText("Filed here")).toBeDefined();
		expect(await screen.findByText("Shown here")).toBeDefined();
		expect(screen.getAllByText("Filed here")).toHaveLength(1);
	});
});

describe("a page without a summary", () => {
	test("points at the MCP tool that writes one", async () => {
		show(aView());

		expect(await screen.findByText("quiz_write_summary")).toBeDefined();
	});

	test("still lists what is filed under it", async () => {
		show(
			aView({ children: [{ id: "folder-2", name: "Bonds", itemCount: 3 }] }),
		);

		expect(await screen.findByText("Bonds")).toBeDefined();
	});
});
