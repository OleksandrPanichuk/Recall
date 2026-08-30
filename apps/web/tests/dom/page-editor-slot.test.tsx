import { afterEach, describe, expect, test } from "bun:test";

const { cleanup, render, screen, waitFor } = await import(
	"@testing-library/react"
);
const { PageEditorSlot } = await import(
	"@/features/pages/ui/components/PageEditorSlot"
);

afterEach(() => {
	cleanup();
});

describe("swapping the summary for the editor", () => {
	test("shows the written page immediately, before the editor exists", () => {
		render(<PageEditorSlot markdown="# Cells" onEdit={() => undefined} />);

		expect(screen.getByRole("heading", { name: "Cells" })).toBeDefined();
	});

	test("never shows a loading line in place of readable content", async () => {
		render(<PageEditorSlot markdown="# Cells" onEdit={() => undefined} />);

		await waitFor(() =>
			expect(document.querySelector(".ProseMirror")).not.toBeNull(),
		);

		expect(screen.queryByText(/завантажується/)).toBeNull();
	});

	test("ends up with exactly one copy of the content, in the editor", async () => {
		render(<PageEditorSlot markdown="# Cells" onEdit={() => undefined} />);

		await waitFor(() =>
			expect(screen.getAllByRole("heading", { name: "Cells" })).toHaveLength(1),
		);

		expect(
			screen
				.getByRole("heading", { name: "Cells" })
				.closest('[contenteditable="true"]'),
		).not.toBeNull();
	});
});
