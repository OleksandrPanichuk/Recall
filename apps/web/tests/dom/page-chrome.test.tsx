import { afterEach, describe, expect, test } from "bun:test";
import type { PageTreeNode } from "@recall/contracts";

const { cleanup, fireEvent, render, screen } = await import(
	"@testing-library/react"
);
const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } =
	await import("@tanstack/react-router");
const { EmojiPicker } = await import(
	"@/features/pages/ui/components/EmojiPicker"
);
const { PageTitle } = await import("@/features/pages/ui/components/PageTitle");
const { PageTree } = await import("@/features/pages/ui/components/PageTree");

afterEach(() => {
	cleanup();
});

const routed = (element: React.ReactNode) =>
	render(
		<RouterProvider
			router={createRouter({
				routeTree: createRootRoute({ component: () => element }),
				history: createMemoryHistory({ initialEntries: ["/"] }),
			})}
		/>,
	);

describe("the page title", () => {
	const titled = (name: string) => {
		const renamed: string[] = [];

		render(<PageTitle name={name} onRename={(next) => renamed.push(next)} />);

		return { renamed, field: screen.getByLabelText("Page title") };
	};

	test("renames on blur, once, with the text trimmed", () => {
		const { renamed, field } = titled("Chapter 1");

		fireEvent.change(field, { target: { value: "  Chapter 2  " } });
		fireEvent.blur(field);

		expect(renamed).toEqual(["Chapter 2"]);
	});

	test("does not rename when nothing changed", () => {
		const { renamed, field } = titled("Chapter 1");

		fireEvent.blur(field);

		expect(renamed).toEqual([]);
	});

	test("refuses to leave a page nameless", () => {
		const { renamed, field } = titled("Chapter 1");

		fireEvent.change(field, { target: { value: "   " } });
		fireEvent.blur(field);

		expect(renamed).toEqual([]);
		expect((field as HTMLInputElement).value).toBe("Chapter 1");
	});

	test("puts the old name back on escape", () => {
		const { renamed, field } = titled("Chapter 1");

		fireEvent.change(field, { target: { value: "typo" } });
		fireEvent.keyDown(field, { key: "Escape" });

		expect((field as HTMLInputElement).value).toBe("Chapter 1");
		expect(renamed).toEqual([]);
	});
});

describe("the icon picker", () => {
	test("picks an emoji and closes", () => {
		const picked: (string | undefined)[] = [];

		render(<EmojiPicker onPick={(icon) => picked.push(icon)} />);
		fireEvent.click(screen.getByLabelText("Page icon"));
		fireEvent.click(screen.getByLabelText("🧬"));

		expect(picked).toEqual(["🧬"]);
		expect(screen.queryByLabelText("🧬")).toBeNull();
	});

	test("offers to remove only an icon that is there", () => {
		const { rerender } = render(<EmojiPicker onPick={() => undefined} />);

		fireEvent.click(screen.getByLabelText("Page icon"));
		expect(screen.queryByText("Remove")).toBeNull();

		rerender(<EmojiPicker icon="🧬" onPick={() => undefined} />);
		expect(screen.getByText("Remove")).toBeDefined();
	});

	test("clears the icon when asked", () => {
		const picked: (string | undefined)[] = [];

		render(<EmojiPicker icon="🧬" onPick={(icon) => picked.push(icon)} />);
		fireEvent.click(screen.getByLabelText("Page icon"));
		fireEvent.click(screen.getByText("Remove"));

		expect(picked).toEqual([undefined]);
	});
});

describe("the page tree", () => {
	const node = (
		id: string,
		name: string,
		depth: number,
		parentId?: string,
	): PageTreeNode => ({
		id,
		name,
		parentId,
		depth,
		setCount: 0,
		unpublishedCount: 0,
	});

	test("nests a child under its parent and lets it be folded away", async () => {
		routed(
			<PageTree
				nodes={[
					node("a", "Biology", 0),
					node("b", "Chapter 1", 1, "a"),
					node("c", "Physics", 0),
				]}
			/>,
		);

		expect(await screen.findByText("Chapter 1")).toBeDefined();

		fireEvent.click(screen.getByLabelText("Collapse Biology"));

		expect(screen.queryByText("Chapter 1")).toBeNull();
		expect(screen.getByText("Physics")).toBeDefined();
	});

	test("says so when there are no pages", async () => {
		routed(<PageTree nodes={[]} />);

		expect(await screen.findByText("No pages yet.")).toBeDefined();
	});

	test("the ends of a list cannot be pushed past them", async () => {
		routed(
			<PageTree
				nodes={[
					node("a", "Biology", 0),
					node("b", "Chemistry", 0),
					node("c", "Physics", 0),
				]}
			/>,
		);

		const disabled = (label: string) =>
			(screen.getByLabelText(label) as HTMLButtonElement).disabled;

		expect(await screen.findByLabelText("Move Biology up")).toBeDefined();
		expect(disabled("Move Biology up")).toBe(true);
		expect(disabled("Move Biology down")).toBe(false);
		expect(disabled("Move Chemistry up")).toBe(false);
		expect(disabled("Move Chemistry down")).toBe(false);
		expect(disabled("Move Physics up")).toBe(false);
		expect(disabled("Move Physics down")).toBe(true);
	});

	test("a page can be picked up for dragging, and a busy tree cannot", async () => {
		routed(
			<PageTree nodes={[node("a", "Biology", 0), node("c", "Physics", 0)]} />,
		);

		expect(await screen.findByLabelText("Drag Biology")).toBeDefined();
		expect(
			(screen.getByLabelText("Drag Physics") as HTMLButtonElement).disabled,
		).toBe(false);
	});

	test("only the roots are open to begin with", async () => {
		routed(
			<PageTree
				nodes={[
					node("a", "Biology", 0),
					node("b", "Chapter 1", 1, "a"),
					node("d", "Section", 2, "b"),
				]}
			/>,
		);

		expect(await screen.findByText("Chapter 1")).toBeDefined();
		expect(screen.queryByText("Section")).toBeNull();

		fireEvent.click(screen.getByLabelText("Expand Chapter 1"));

		expect(screen.getByText("Section")).toBeDefined();
	});

	test("a lone child of its parent cannot be moved either way", async () => {
		routed(
			<PageTree
				nodes={[node("a", "Biology", 0), node("b", "Chapter 1", 1, "a")]}
			/>,
		);

		expect(
			((await screen.findByLabelText("Move Chapter 1 up")) as HTMLButtonElement)
				.disabled,
		).toBe(true);
		expect(
			(screen.getByLabelText("Move Chapter 1 down") as HTMLButtonElement)
				.disabled,
		).toBe(true);
	});
});
