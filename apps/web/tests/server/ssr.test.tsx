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

	expect(html).toContain("No such link");
});

test("the accuracy trend renders on the server, chart and all", async () => {
	const { renderToString } = await import("react-dom/server");
	const { AccuracyTrend } = await import(
		"@/features/statistics/ui/components/AccuracyTrend"
	);

	const activity = Array.from({ length: 8 }, (_, week) => ({
		day: new Date(Date.UTC(2026, 5, 1 + week * 7)).toISOString().slice(0, 10),
		attempts: 1,
		answered: 10,
		correct: 10 - week,
	}));

	const html = renderToString(<AccuracyTrend activity={activity} />);

	expect(html).toContain("<svg");
	expect(html).toContain("100%");
	expect(html).toContain("weeks");
});

test("and says so plainly when there is not enough practice to draw one", async () => {
	const { renderToString } = await import("react-dom/server");
	const { AccuracyTrend } = await import(
		"@/features/statistics/ui/components/AccuracyTrend"
	);

	const html = renderToString(<AccuracyTrend activity={[]} />);

	expect(html).not.toContain("<svg");
	expect(html).toContain("So far there are");
});
