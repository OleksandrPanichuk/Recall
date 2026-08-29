import { expect, test } from "bun:test";

test("a page renders its summary on the server, without a DOM", async () => {
	expect("document" in globalThis).toBe(false);

	const { renderToString } = await import("react-dom/server");
	const { PageBody } = await import("@/features/pages/ui/components/PageBody");

	const html = renderToString(
		<PageBody
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
