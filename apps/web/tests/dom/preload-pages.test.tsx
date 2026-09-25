import { afterEach, describe, expect, test } from "bun:test";
import type { PageTreeNode } from "@recall/contracts";
import { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

const { act, cleanup, renderHook } = await import("@testing-library/react");
const {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterContextProvider,
} = await import("@tanstack/react-router");
const { usePreloadPages } = await import(
	"@/features/pages/hooks/use-preload-pages"
);
const { sessionFor } = await import("@/shared/lib/viewer");

afterEach(() => {
	cleanup();
});

const settle = (ms: number) =>
	act(() => new Promise((resolve) => setTimeout(resolve, ms)));

const node = (id: string, depth = 0): PageTreeNode => ({
	id,
	name: id,
	icon: undefined,
	parentId: undefined,
	depth,
	setCount: 0,
	unpublishedCount: 0,
});

const watching = () => {
	const router = createRouter({
		routeTree: createRootRoute(),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	const preloaded: string[] = [];

	router.preloadRoute = (async (options: { params: { folderId: string } }) => {
		preloaded.push(options.params.folderId);

		return undefined;
	}) as unknown as typeof router.preloadRoute;

	const wrapper = ({ children }: { children: ReactNode }) => (
		<RouterContextProvider router={router}>{children}</RouterContextProvider>
	);

	return { preloaded, wrapper };
};

describe("warming the pages in the sidebar", () => {
	test("preloads each top-level page once", async () => {
		const { preloaded, wrapper } = watching();

		renderHook(() => usePreloadPages([node("a"), node("b"), node("c", 3)]), {
			wrapper,
		});
		await settle(500);

		expect(preloaded).toEqual(["a", "b"]);
	});

	test("does not start again when the tree is reloaded with the same pages", async () => {
		const { preloaded, wrapper } = watching();
		const { rerender } = renderHook(
			({ nodes }: { nodes: PageTreeNode[] }) => usePreloadPages(nodes),
			{ wrapper, initialProps: { nodes: [node("a"), node("b")] } },
		);

		await settle(400);
		rerender({ nodes: [node("a"), node("b")] });
		rerender({ nodes: [node("a"), node("b")] });
		await settle(400);

		expect(preloaded).toEqual(["a", "b"]);
	});

	test("preloads only the page that is new", async () => {
		const { preloaded, wrapper } = watching();
		const { rerender } = renderHook(
			({ nodes }: { nodes: PageTreeNode[] }) => usePreloadPages(nodes),
			{ wrapper, initialProps: { nodes: [node("a")] } },
		);

		await settle(300);
		rerender({ nodes: [node("a"), node("b")] });
		await settle(300);

		expect(preloaded).toEqual(["a", "b"]);
	});
});

describe("the session a route is loaded under", () => {
	const signedIn = { viewer: { id: "owner-1" } };

	test("a preload reuses the session it already has", async () => {
		const queryClient = new QueryClient();

		queryClient.setQueryData(["session"], signedIn);

		expect(await sessionFor(queryClient, true)).toBe(signedIn as never);
	});

	test("a real navigation asks again", async () => {
		const queryClient = new QueryClient();

		queryClient.setQueryData(["session"], signedIn);

		const asked = await sessionFor(queryClient, false).then(
			() => "cached",
			() => "asked the server",
		);

		expect(asked).toBe("asked the server");
	});
});
