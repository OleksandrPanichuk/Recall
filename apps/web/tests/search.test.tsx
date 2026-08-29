import { afterEach, describe, expect, test } from "bun:test";
import type { PageMatch } from "@recall/contracts";

const { cleanup, fireEvent, render, screen } = await import(
	"@testing-library/react"
);
const { createMemoryHistory, createRootRoute, createRouter, RouterProvider } =
	await import("@tanstack/react-router");
const { PageSearch } = await import("@/components/PageSearch");

afterEach(() => {
	cleanup();
});

const show = (onSearch: (query: string) => Promise<readonly PageMatch[]>) => {
	const rootRoute = createRootRoute({
		component: () => <PageSearch onSearch={onSearch} />,
	});

	return render(
		<RouterProvider
			router={createRouter({
				routeTree: rootRoute,
				history: createMemoryHistory({ initialEntries: ["/"] }),
			})}
		/>,
	);
};

const type = async (value: string) => {
	fireEvent.change(await screen.findByLabelText("Пошук сторінок"), {
		target: { value },
	});
};

describe("searching the library", () => {
	test("lists a match with the excerpt around it", async () => {
		show(async () => [
			{
				folderId: "folder-1",
				name: "Chapter 5",
				excerpt: "…several machines…",
			},
		]);

		await type("replication");

		expect(await screen.findByText("Chapter 5")).toBeDefined();
		expect(screen.getByText("…several machines…")).toBeDefined();
	});

	test("says when nothing matched", async () => {
		show(async () => []);

		await type("quantum");

		expect(await screen.findByText("Нічого не знайдено.")).toBeDefined();
	});

	test("asks for nothing until something is typed", async () => {
		const asked: string[] = [];

		show(async (query) => {
			asked.push(query);

			return [];
		});

		await type("   ");

		expect(asked).toEqual([]);
		expect(screen.queryByText("Нічого не знайдено.")).toBeNull();
	});
});
