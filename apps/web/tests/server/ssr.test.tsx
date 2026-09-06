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

test("a shared page renders on the server, with its images already public", async () => {
	const { renderToString } = await import("react-dom/server");
	const { SharedPageView } = await import(
		"@/features/pages/ui/views/SharedPageView"
	);

	const token = "9f8e7d6c5b4a39281706f5e4d3c2b1a0";
	const image = "11111111-1111-4111-8111-111111111111";
	const html = renderToString(
		<SharedPageView
			token={token}
			page={{
				name: "Durability",
				icon: "📓",
				summary: `# WAL\n\n![dot](/app/uploads/${image})`,
				updatedAt: "2026-09-06T10:00:00.000Z",
			}}
		/>,
	);

	expect(html).toContain("<h1>WAL</h1>");
	expect(html).toContain(`/public/uploads/${token}/${image}`);
	expect(html).not.toContain("/app/uploads");
});

test("a link that no longer works says so rather than rendering nothing", async () => {
	const { renderToString } = await import("react-dom/server");
	const { SharedPageView } = await import(
		"@/features/pages/ui/views/SharedPageView"
	);

	const html = renderToString(<SharedPageView token="gone" page={null} />);

	expect(html).toContain("Такого посилання немає");
});
