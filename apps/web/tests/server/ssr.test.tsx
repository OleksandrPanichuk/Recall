import { expect, test } from "bun:test";

test("a page renders its summary on the server, without a DOM", async () => {
	expect("document" in globalThis).toBe(false);

	const { renderToString } = await import("react-dom/server");
	const { PageView } = await import("@/components/PageView");

	const html = renderToString(
		<PageView
			view={{
				folderId: "folder-1",
				name: "Chapter 1",
				summary: "# Cells",
				breadcrumb: [],
				children: [],
				sets: [],
				attached: [],
			}}
			onEdit={() => undefined}
		/>,
	);

	expect(html).toContain("<h1>Cells</h1>");
	expect(html).not.toContain("ProseMirror");
});
