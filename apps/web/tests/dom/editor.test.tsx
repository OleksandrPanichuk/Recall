import { afterEach, describe, expect, test } from "bun:test";

const { cleanup, fireEvent, render, screen, waitFor } = await import(
	"@testing-library/react"
);
const { SummaryEditor } = await import("@/components/SummaryEditor");

afterEach(() => {
	cleanup();
});

const open = (summary: string) => {
	const saved: string[] = [];
	const cancelled: true[] = [];

	render(
		<SummaryEditor
			summary={summary}
			saving={false}
			onSave={(written) => saved.push(written)}
			onCancel={() => cancelled.push(true)}
		/>,
	);

	return { saved, cancelled };
};

const ready = async () =>
	waitFor(() => {
		const save = screen.getByText("Зберегти").closest("button");

		expect(save?.disabled).toBe(false);

		return save as HTMLButtonElement;
	});

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

	test("hands back the markdown the editor holds", async () => {
		const { saved } = open("# Cells\n\nAnd nuclei.");

		fireEvent.click(await ready());

		expect(saved).toHaveLength(1);
		expect(saved[0]?.trim()).toBe("# Cells\n\nAnd nuclei.");
	});

	test("cannot be saved before the editor has loaded", () => {
		open("# Cells");

		expect(
			(screen.getByText("Зберегти").closest("button") as HTMLButtonElement)
				.disabled,
		).toBe(true);
	});

	test("saves nothing when the edit is cancelled", async () => {
		const { saved, cancelled } = open("# Cells");

		await ready();
		fireEvent.click(screen.getByText("Скасувати"));

		expect(saved).toEqual([]);
		expect(cancelled).toEqual([true]);
	});
});
