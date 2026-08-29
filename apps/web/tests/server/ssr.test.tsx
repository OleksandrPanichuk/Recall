import { expect, test } from "bun:test";

test("the editor renders on the server without a DOM", async () => {
	expect("document" in globalThis).toBe(false);

	const { renderToString } = await import("react-dom/server");
	const { SummaryEditor } = await import("@/components/SummaryEditor");

	const html = renderToString(
		<SummaryEditor
			summary="# Cells"
			saving={false}
			onSave={() => undefined}
			onCancel={() => undefined}
		/>,
	);

	expect(html).toContain("Редактор завантажується");
	expect(html).not.toContain("ProseMirror");
});
