import { afterEach, describe, expect, test } from "bun:test";

const { cleanup, render, screen, waitFor } = await import(
	"@testing-library/react"
);
const { NotionEditor } = await import(
	"@/features/pages/ui/components/NotionEditor"
);

afterEach(() => {
	cleanup();
});

const open = (markdown: string) => {
	const written: string[] = [];

	render(
		<NotionEditor
			markdown={markdown}
			onChange={(next) => written.push(next)}
		/>,
	);

	return written;
};

describe("the page editor", () => {
	test("renders the markdown as blocks, not as source text", async () => {
		open("# Cells\n\nEvery living thing is made of them.");

		expect(await screen.findByRole("heading", { name: "Cells" })).toBeDefined();
		expect(
			await screen.findByText("Every living thing is made of them."),
		).toBeDefined();
	});

	test("renders those blocks inside the editable surface itself", async () => {
		open("# Cells");

		const heading = await screen.findByRole("heading", { name: "Cells" });

		expect(heading.closest('[contenteditable="true"]')).not.toBeNull();
	});

	test("reports nothing while the document has not changed", async () => {
		const written = open("# Cells");

		await screen.findByRole("heading", { name: "Cells" });
		await waitFor(() => expect(written).toEqual([]));
	});

	test("renders a list as list items", async () => {
		open("- membrane\n- nucleus");

		expect(
			(await screen.findAllByRole("listitem")).map((item) =>
				(item.textContent ?? "").trim(),
			),
		).toEqual(["membrane", "nucleus"]);
	});
});
