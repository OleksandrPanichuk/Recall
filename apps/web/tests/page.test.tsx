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
	...over,
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
				sets: [
					{
						id: "quiz-1",
						title: "Periodic table",
						status: "published",
						questionCount: 1,
						updatedAt: "2026-08-20T00:00:00.000Z",
					},
				],
			}),
		);

		expect(await screen.findByText("Bonds")).toBeDefined();
		expect(await screen.findByText("Periodic table")).toBeDefined();
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
