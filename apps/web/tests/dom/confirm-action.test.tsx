import { afterEach, describe, expect, test } from "bun:test";
import type { BrowseView, QuizDetail } from "@recall/contracts";
import { QuestionType } from "@recall/contracts";
import type { ReactNode } from "react";

const { cleanup, fireEvent, render, screen, waitFor } = await import(
	"@testing-library/react"
);
const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } =
	await import("@tanstack/react-router");
const { ConfirmAction } = await import("@/shared/ui/components/ConfirmAction");
const { ApiTokens } = await import("@/features/tokens/ui/components/ApiTokens");
const { PageActions } = await import(
	"@/features/pages/ui/components/PageActions"
);
const { QuizEditorView } = await import(
	"@/features/authoring/ui/views/QuizEditorView"
);

afterEach(() => {
	cleanup();
});

const routed = (node: ReactNode) =>
	render(
		<RouterProvider
			router={createRouter({
				routeTree: createRootRoute({ component: () => node }),
				history: createMemoryHistory({ initialEntries: ["/"] }),
			})}
		/>,
	);

const confirming = (onConfirm: () => Promise<void>) =>
	render(
		<ConfirmAction
			title="Delete it?"
			description="It will be gone."
			confirmLabel="Delete"
			onConfirm={onConfirm}
			trigger={<button type="button">Remove</button>}
		/>,
	);

describe("a destructive action", () => {
	test("does nothing until it is confirmed", async () => {
		let calls = 0;

		confirming(async () => {
			calls += 1;
		});
		fireEvent.click(screen.getByText("Remove"));

		expect(await screen.findByRole("alertdialog")).toBeDefined();
		expect(calls).toBe(0);

		fireEvent.click(screen.getByText("Delete"));

		await waitFor(() => expect(calls).toBe(1));
		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
	});

	test("cancelling leaves everything as it was", async () => {
		let calls = 0;

		confirming(async () => {
			calls += 1;
		});
		fireEvent.click(screen.getByText("Remove"));
		fireEvent.click(await screen.findByText("Cancel"));

		await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
		expect(calls).toBe(0);
	});

	test("says so and stays open when it fails", async () => {
		confirming(async () => {
			throw new Error("offline");
		});
		fireEvent.click(screen.getByText("Remove"));
		fireEvent.click(await screen.findByText("Delete"));

		expect((await screen.findByRole("alert")).textContent).toContain(
			"did not go through",
		);
		expect(screen.getByRole("alertdialog")).toBeDefined();
	});
});

const aPage = (over: Partial<BrowseView> = {}): BrowseView => ({
	folderId: "folder-1",
	name: "Chapter 1",
	summary: undefined,
	icon: undefined,
	parentId: undefined,
	breadcrumb: [],
	children: [],
	sets: [],
	attached: [],
	...over,
});

const actionsFor = (view: BrowseView) =>
	routed(
		<PageActions
			view={view}
			pages={[]}
			sets={[]}
			onChanged={() => undefined}
			onFlush={async () => {}}
			onAttach={async () => {}}
			onShare={async () => {}}
			onUnshare={async () => {}}
		/>,
	);

describe("deleting a page", () => {
	test("asks first, naming the page", async () => {
		actionsFor(aPage());

		fireEvent.click(await screen.findByLabelText("Delete page"));

		expect((await screen.findByRole("alertdialog")).textContent).toContain(
			"Chapter 1",
		);
	});

	test("is not offered for a page that has text on it", async () => {
		actionsFor(aPage({ summary: "Notes worth keeping" }));

		await screen.findByText("Subpage");

		expect(screen.queryByLabelText("Delete page")).toBeNull();
	});

	test("is offered for a page whose text is only whitespace", async () => {
		actionsFor(aPage({ summary: "  \n " }));

		expect(await screen.findByLabelText("Delete page")).toBeDefined();
	});
});

describe("revoking a token", () => {
	test("asks first, naming the token", async () => {
		routed(
			<ApiTokens
				tokens={[
					{
						id: "t1",
						name: "Claude",
						scopes: [],
						createdAt: "2026-01-01T00:00:00.000Z",
					},
				]}
			/>,
		);

		fireEvent.click(await screen.findByLabelText("Revoke Claude"));

		expect((await screen.findByRole("alertdialog")).textContent).toContain(
			"Revoke Claude?",
		);
	});
});

const aQuiz: QuizDetail = {
	id: "quiz-1",
	title: "Nouns",
	language: "de",
	status: "draft",
	tags: [],
	folderId: undefined,
	updatedAt: "2026-01-01T00:00:00.000Z",
	questions: [
		{
			id: "question-1",
			type: QuestionType.SingleChoice,
			prompt: "der Zug",
			options: [],
			difficulty: "medium",
			position: 0,
		},
	],
};

describe("deleting a question", () => {
	test("asks first, quoting the question", async () => {
		routed(<QuizEditorView quiz={aQuiz} vocabulary={[]} pages={[]} />);

		fireEvent.click(await screen.findByLabelText("Delete question 1"));

		expect((await screen.findByRole("alertdialog")).textContent).toContain(
			"der Zug",
		);
	});
});
