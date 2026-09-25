import { afterEach, describe, expect, mock, test } from "bun:test";
import type { BrowseView, PageTreeNode, QuizSummary } from "@recall/contracts";
import type { ReactNode } from "react";

const { act, cleanup, fireEvent, render, screen, waitFor } = await import(
	"@testing-library/react"
);
const { EmojiPicker } = await import(
	"@/features/pages/ui/components/EmojiPicker"
);
const { AttachQuiz } = await import(
	"@/features/pages/ui/components/AttachQuiz"
);
const { MoveQuizSet } = await import(
	"@/features/authoring/ui/components/MoveQuizSet"
);
const { SharePage } = await import("@/features/pages/ui/components/SharePage");

afterEach(() => {
	cleanup();
});

const TOKEN = "9f8e7d6c5b4a39281706f5e4d3c2b1a0";

const page: BrowseView = {
	folderId: "page",
	name: "Runtimes",
	breadcrumb: [],
	children: [],
	sets: [],
	attached: [],
};

const quiz: QuizSummary = {
	id: "bun",
	title: "Bun basics",
	status: "published",
	questionCount: 3,
	updatedAt: "2026-01-01T00:00:00.000Z",
};

const pages: readonly PageTreeNode[] = [
	{
		id: "books",
		name: "Books",
		depth: 0,
		setCount: 0,
		unpublishedCount: 0,
	},
];

const popovers: readonly [string, string, () => ReactNode][] = [
	[
		"the emoji picker",
		"Page icon",
		() => <EmojiPicker onPick={() => undefined} />,
	],
	[
		"attach quiz",
		"Attach quiz",
		() => (
			<AttachQuiz view={page} sets={[quiz]} onAttach={async () => undefined} />
		),
	],
	[
		"file in a page",
		"File in a page",
		() => (
			<MoveQuizSet pages={pages} busy={false} onMove={async () => undefined} />
		),
	],
	[
		"share",
		"Share page",
		() => (
			<SharePage
				busy={false}
				onShare={async () => undefined}
				onUnshare={async () => undefined}
			/>
		),
	],
];

describe("a popover", () => {
	for (const [name, label, node] of popovers) {
		test(`${name} announces what it opens and whether it is open`, () => {
			render(node());

			const trigger = screen.getByRole("button", { name: label });

			expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
			expect(trigger.getAttribute("aria-expanded")).toBe("false");

			fireEvent.click(trigger);

			expect(trigger.getAttribute("aria-expanded")).toBe("true");
			expect(trigger.getAttribute("aria-controls")).toBe(
				screen.getByRole("dialog").id,
			);
		});

		test(`${name} closes on Escape and gives focus back to its button`, async () => {
			render(node());

			const trigger = screen.getByRole("button", { name: label });

			fireEvent.click(trigger);

			const dialog = screen.getByRole("dialog");

			fireEvent.keyDown(dialog, { key: "Escape" });

			await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
			expect(trigger.getAttribute("aria-expanded")).toBe("false");
			expect(document.activeElement).toBe(trigger);
		});
	}
});

describe("picking from a popover", () => {
	test("an emoji closes the picker and hands focus back", async () => {
		const onPick = mock((_icon: string | undefined) => undefined);

		render(<EmojiPicker onPick={onPick} />);

		const trigger = screen.getByRole("button", { name: "Page icon" });

		fireEvent.click(trigger);
		fireEvent.click(screen.getByRole("button", { name: "📘" }));

		expect(onPick).toHaveBeenCalledWith("📘");
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(document.activeElement).toBe(trigger);
	});

	test("attaching a quiz closes the list", async () => {
		const onAttach = mock(async (_id: string) => undefined);

		render(<AttachQuiz view={page} sets={[quiz]} onAttach={onAttach} />);
		fireEvent.click(screen.getByRole("button", { name: "Attach quiz" }));
		fireEvent.click(screen.getByRole("button", { name: "Bun basics" }));

		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(onAttach).toHaveBeenCalledWith("bun");
	});

	test("a press outside the popover closes it", async () => {
		render(
			<>
				<button type="button">elsewhere</button>
				<AttachQuiz
					view={page}
					sets={[quiz]}
					onAttach={async () => undefined}
				/>
			</>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Attach quiz" }));
		expect(screen.getByRole("dialog")).toBeDefined();
		await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

		const elsewhere = screen.getByRole("button", { name: "elsewhere" });

		fireEvent.pointerDown(elsewhere, { pointerType: "mouse", button: 0 });
		fireEvent.click(elsewhere);

		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});
});

describe("sharing a page", () => {
	const opened = (props: {
		readonly onShare?: (rotate: boolean) => Promise<void>;
		readonly onUnshare?: () => Promise<void>;
		readonly busy?: boolean;
	}) => {
		render(
			<SharePage
				token={TOKEN}
				busy={props.busy ?? false}
				onShare={props.onShare ?? (async () => undefined)}
				onUnshare={props.onUnshare ?? (async () => undefined)}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Share page" }));
	};

	test("a double click on a new link rotates once, not twice", async () => {
		let settle: () => void = () => undefined;
		const onShare = mock(
			() =>
				new Promise<void>((resolve) => {
					settle = resolve;
				}),
		);

		opened({ onShare });

		const rotate = screen.getByRole("button", { name: "Create a new link" });

		fireEvent.click(rotate);
		fireEvent.click(rotate);

		expect(onShare).toHaveBeenCalledTimes(1);
		expect(onShare).toHaveBeenCalledWith(true);
		expect(
			(
				screen.getByRole("button", {
					name: "Stop sharing",
				}) as HTMLButtonElement
			).disabled,
		).toBe(true);

		await act(async () => settle());

		expect((rotate as HTMLButtonElement).disabled).toBe(false);
	});

	test("says so when a new link could not be made", async () => {
		opened({ onShare: async () => Promise.reject(new Error("503")) });

		fireEvent.click(screen.getByRole("button", { name: "Create a new link" }));

		expect((await screen.findByRole("alert")).textContent).toBe(
			"Could not replace the link. Try again.",
		);
	});

	test("says so when sharing could not be stopped", async () => {
		opened({ onUnshare: async () => Promise.reject(new Error("503")) });

		fireEvent.click(screen.getByRole("button", { name: "Stop sharing" }));

		expect((await screen.findByRole("alert")).textContent).toBe(
			"Could not stop sharing. Try again.",
		);
	});

	test("says so when the first link could not be made", async () => {
		render(
			<SharePage
				busy={false}
				onShare={async () => Promise.reject(new Error("503"))}
				onUnshare={async () => undefined}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: "Share page" }));
		fireEvent.click(screen.getByRole("button", { name: "Create link" }));

		expect((await screen.findByRole("alert")).textContent).toBe(
			"Could not create the link. Try again.",
		);
	});

	test("says so when the clipboard refuses the link", async () => {
		const clipboard = navigator.clipboard;
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText: async () => Promise.reject(new Error("denied")) },
		});

		try {
			opened({});
			fireEvent.click(screen.getByRole("button", { name: "Copy" }));

			expect((await screen.findByRole("alert")).textContent).toBe(
				"Could not copy. Select the link and copy it by hand.",
			);
		} finally {
			Object.defineProperty(navigator, "clipboard", {
				configurable: true,
				value: clipboard,
			});
		}
	});
});
