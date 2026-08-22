import { describe, expect, test } from "bun:test";
import { type ListShape, listPage, listQueryOf } from "./query";

interface Row {
	readonly id: string;
	readonly title: string;
	readonly status: string;
	readonly count: number;
	readonly tags: readonly string[];
}

const ROWS: readonly Row[] = [
	{ id: "1", title: "Food", status: "published", count: 52, tags: ["a1"] },
	{ id: "2", title: "Clothes", status: "published", count: 76, tags: ["a1"] },
	{ id: "3", title: "Draft set", status: "draft", count: 0, tags: ["ddia"] },
];

const SHAPE: ListShape<Row> = {
	searchIn: (row) => [row.title],
	value: (row, field) => (row as unknown as Record<string, unknown>)[field],
};

const queryOf = (search: string) =>
	listQueryOf(new URL(`http://localhost/api/sets${search}`));

describe("reading a list query", () => {
	test("reads the json-server parameters react-admin sends", () => {
		const query = queryOf("?_sort=title&_order=DESC&_start=0&_end=25");

		expect(query).toEqual({
			sort: "title",
			order: "DESC",
			start: 0,
			end: 25,
			ids: [],
			filters: {},
		});
	});

	test("defaults to ascending", () => {
		expect(queryOf("?_sort=title").order).toBe("ASC");
	});

	test("collects repeated id parameters for getMany", () => {
		expect(queryOf("?id=1&id=2").ids).toEqual(["1", "2"]);
	});

	test("keeps every other parameter as a filter", () => {
		expect(queryOf("?status=draft&quizSetId=7").filters).toEqual({
			status: "draft",
			quizSetId: "7",
		});
	});

	test("takes q as a search rather than a filter", () => {
		const query = queryOf("?q=food&status=draft");

		expect(query.search).toBe("food");
		expect(query.filters).toEqual({ status: "draft" });
	});

	test("ignores an empty value, which is how react-admin clears a filter", () => {
		expect(queryOf("?status=&q=").filters).toEqual({});
		expect(queryOf("?status=&q=").search).toBeUndefined();
	});

	test("ignores a nonsense range instead of returning nothing", () => {
		expect(queryOf("?_start=-5&_end=abc").start).toBeUndefined();
		expect(queryOf("?_start=-5&_end=abc").end).toBeUndefined();
	});
});

describe("building a list page", () => {
	test("returns everything when nothing is asked", () => {
		const page = listPage(ROWS, queryOf(""), SHAPE);

		expect(page.total).toBe(3);
		expect(page.rows).toHaveLength(3);
	});

	test("reports the total before the page, not after", () => {
		const page = listPage(ROWS, queryOf("?_start=0&_end=2"), SHAPE);

		expect(page.rows).toHaveLength(2);
		expect(page.total).toBe(3);
	});

	test("filters by an exact field", () => {
		const page = listPage(ROWS, queryOf("?status=draft"), SHAPE);

		expect(page.rows.map((row) => row.id)).toEqual(["3"]);
		expect(page.total).toBe(1);
	});

	test("matches a filter against any entry of a list field", () => {
		const page = listPage(ROWS, queryOf("?tags=ddia"), SHAPE);

		expect(page.rows.map((row) => row.id)).toEqual(["3"]);
	});

	test("searches case-insensitively inside the searchable fields", () => {
		const page = listPage(ROWS, queryOf("?q=FOO"), SHAPE);

		expect(page.rows.map((row) => row.title)).toEqual(["Food"]);
	});

	test("combines a search with a filter", () => {
		const page = listPage(ROWS, queryOf("?q=set&status=published"), SHAPE);

		expect(page.rows).toEqual([]);
		expect(page.total).toBe(0);
	});

	test("sorts by a text field", () => {
		const page = listPage(ROWS, queryOf("?_sort=title&_order=ASC"), SHAPE);

		expect(page.rows.map((row) => row.title)).toEqual([
			"Clothes",
			"Draft set",
			"Food",
		]);
	});

	test("sorts numbers as numbers, not as text", () => {
		const page = listPage(ROWS, queryOf("?_sort=count&_order=DESC"), SHAPE);

		expect(page.rows.map((row) => row.count)).toEqual([76, 52, 0]);
	});

	test("selects the ids getMany asked for", () => {
		const page = listPage(ROWS, queryOf("?id=3&id=1"), SHAPE);

		expect(page.rows.map((row) => row.id)).toEqual(["1", "3"]);
	});

	test("pages after filtering, not before", () => {
		const page = listPage(
			ROWS,
			queryOf("?status=published&_start=1&_end=2"),
			SHAPE,
		);

		expect(page.rows.map((row) => row.id)).toEqual(["2"]);
		expect(page.total).toBe(2);
	});

	test("leaves the caller's rows untouched", () => {
		listPage(ROWS, queryOf("?_sort=title&_order=DESC"), SHAPE);

		expect(ROWS.map((row) => row.id)).toEqual(["1", "2", "3"]);
	});
});
