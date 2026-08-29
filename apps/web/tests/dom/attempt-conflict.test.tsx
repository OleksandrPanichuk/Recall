import { afterEach, describe, expect, test } from "bun:test";

const { cleanup, fireEvent, render, screen } = await import(
	"@testing-library/react"
);
const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } =
	await import("@tanstack/react-router");
const { AttemptInProgress } = await import("@/components/AttemptInProgress");

afterEach(() => {
	cleanup();
});

const show = (
	title: string | null,
	quizSetId: string | null,
	onAbandon: () => Promise<void> = async () => undefined,
) =>
	render(
		<RouterProvider
			router={createRouter({
				routeTree: createRootRoute({
					component: () => (
						<AttemptInProgress
							title={title}
							quizSetId={quizSetId}
							onAbandon={onAbandon}
						/>
					),
				}),
				history: createMemoryHistory({ initialEntries: ["/"] }),
			})}
		/>,
	);

describe("an attempt already in progress", () => {
	test("names the set that is blocking, rather than showing an id", async () => {
		show("DDIA — Розділ 2", "quiz-1");

		expect(
			await screen.findByText(/Ви вже почали «DDIA — Розділ 2»/),
		).toBeDefined();
		expect(screen.queryByText(/quiz-1/)).toBeNull();
	});

	test("offers to continue the blocking attempt", async () => {
		show("Клітина", "quiz-1");

		const link = (await screen.findByText("Продовжити ту спробу")).closest("a");

		expect(link?.getAttribute("href")).toBe("/practice/quiz-1");
	});

	test("still explains itself when the set cannot be named", async () => {
		show(null, null);

		expect(await screen.findByText(/Ви вже почали інший набір/)).toBeDefined();
		expect(screen.queryByText("Продовжити ту спробу")).toBeNull();
	});

	test("abandons on request, and says it is working", async () => {
		let release = (): void => undefined;
		const abandoned: true[] = [];
		const onAbandon = async () => {
			abandoned.push(true);
			await new Promise<void>((resolve) => {
				release = resolve;
			});
		};

		show("Клітина", "quiz-1", onAbandon);

		fireEvent.click(
			await screen.findByText("Скасувати її та почати цей набір"),
		);

		expect(abandoned).toEqual([true]);
		expect(await screen.findByText("Скасовуємо…")).toBeDefined();

		release();
	});
});
