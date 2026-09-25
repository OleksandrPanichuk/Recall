import { afterEach, describe, expect, test } from "bun:test";
import type { BrowseView } from "@recall/contracts";
import type { ReactNode } from "react";

const { act, cleanup, renderHook } = await import("@testing-library/react");
const {
	createMemoryHistory,
	createRootRoute,
	createRouter,
	RouterContextProvider,
} = await import("@tanstack/react-router");
const { usePageEditing } = await import(
	"@/features/pages/hooks/use-page-editing"
);
const { AUTOSAVE_DELAY } = await import("@/features/pages/hooks/use-autosave");
const { Route: FolderRoute } = await import("@/routes/folders.$folderId");

afterEach(() => {
	cleanup();
});

const settle = (ms: number) =>
	act(() => new Promise((resolve) => setTimeout(resolve, ms)));

const aView = (folderId: string, summary = ""): BrowseView => ({
	folderId,
	name: folderId,
	summary,
	icon: undefined,
	parentId: undefined,
	breadcrumb: [],
	children: [],
	sets: [],
	attached: [],
});

const router = createRouter({
	routeTree: createRootRoute(),
	history: createMemoryHistory({ initialEntries: ["/"] }),
});

const wrapper = ({ children }: { children: ReactNode }) => (
	<RouterContextProvider router={router}>{children}</RouterContextProvider>
);

const editingWith = (
	server: Map<string, string>,
	release: () => Promise<void> = async () => {},
) =>
	renderHook(
		({ folderId }: { folderId: string }) =>
			usePageEditing(folderId, aView(folderId), async ({ data }) => {
				await release();
				server.set(data.folderId, data.summary);

				return aView(data.folderId, data.summary);
			}),
		{ wrapper, initialProps: { folderId: "A" } },
	);

describe("editing a page and moving to another one", () => {
	test("an edit typed on A lands on A, and B is left alone", async () => {
		const server = new Map<string, string>();
		const { result, rerender } = editingWith(server);

		act(() => result.current.schedule("written on A"));
		rerender({ folderId: "B" });
		await settle(AUTOSAVE_DELAY + 100);

		expect(server.get("A")).toBe("written on A");
		expect(server.has("B")).toBe(false);
	});

	test("A's edit is saved on the way out, before B is typed into", async () => {
		const server = new Map<string, string>();
		const { result, rerender } = editingWith(server);

		act(() => result.current.schedule("written on A"));
		rerender({ folderId: "B" });
		await settle(10);

		expect(server.get("A")).toBe("written on A");

		act(() => result.current.schedule("written on B"));
		await settle(AUTOSAVE_DELAY + 100);

		expect(server.get("A")).toBe("written on A");
		expect(server.get("B")).toBe("written on B");
	});

	test("the page route mounts a fresh screen for every page", () => {
		const remount = FolderRoute.options.remountDeps as (options: {
			params: { folderId: string };
		}) => unknown;

		expect(remount({ params: { folderId: "A" } })).not.toEqual(
			remount({ params: { folderId: "B" } }),
		);
		expect(remount({ params: { folderId: "A" } })).toEqual(
			remount({ params: { folderId: "A" } }),
		);
	});
});

describe("restoring an old version", () => {
	test("throws away the edit that was waiting, so it cannot overwrite the restore", async () => {
		const server = new Map<string, string>();
		const { result } = editingWith(server);

		act(() => result.current.schedule("typed just before restoring"));
		await act(() => result.current.restore("the old version"));
		await settle(AUTOSAVE_DELAY + 100);

		expect(server.get("A")).toBe("the old version");
	});

	test("waits for a save already in flight before writing the old version", async () => {
		const server = new Map<string, string>();
		let open = () => {};
		const gate = new Promise<void>((resolve) => {
			open = resolve;
		});
		let calls = 0;
		const { result } = editingWith(server, async () => {
			calls += 1;

			if (calls === 1) {
				await gate;
			}
		});

		act(() => result.current.schedule("typed before restoring"));
		await settle(AUTOSAVE_DELAY + 50);

		let restoring = Promise.resolve();

		act(() => {
			restoring = result.current.restore("the old version");
		});
		await act(async () => {
			open();
			await restoring;
		});

		expect(server.get("A")).toBe("the old version");
	});
});
