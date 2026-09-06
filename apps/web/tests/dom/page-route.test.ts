import { describe, expect, test } from "bun:test";
import type { BrowseView, QuizSummary } from "@recall/contracts";
import { pageRouteData } from "@/features/pages/lib/page-route";

const quiz = (id: string, title: string): QuizSummary => ({
	id,
	title,
	status: "published",
	questionCount: 3,
	updatedAt: "2026-01-01T00:00:00.000Z",
});

const own = quiz("mine", "Chapter 01 — Practical Review");
const elsewhere = [
	own,
	quiz("a1", "A1 Clothes Vocabulary"),
	quiz("sql", "SQL"),
];

const view: BrowseView = {
	folderId: "chapter-1",
	name: "Chapter 01",
	breadcrumb: [],
	children: [],
	sets: [own],
	attached: [],
};

describe("what the page route hands the screen", () => {
	test("the page keeps its own quizzes, not the whole library", () => {
		const data = pageRouteData({
			page: view,
			revisions: [],
			quizzes: elsewhere,
		});

		expect(data?.page.sets.map((set) => set.id)).toEqual(["mine"]);
	});

	test("the library list is a separate field, for the attach picker", () => {
		const data = pageRouteData({
			page: view,
			revisions: [],
			quizzes: elsewhere,
		});

		expect(data?.attachable).toHaveLength(3);
		expect(data?.page.sets).toHaveLength(1);
	});

	test("a page nobody can read stays null", () => {
		expect(
			pageRouteData({ page: null, revisions: [], quizzes: elsewhere }),
		).toBeNull();
	});

	test("the attempt in progress and the revisions come through", () => {
		const data = pageRouteData({
			page: view,
			inProgressQuizId: "mine",
			revisions: [
				{
					id: "r1",
					title: "Chapter 01",
					authorKind: "user",
					createdAt: "2026-01-01T00:00:00.000Z",
				},
			],
			quizzes: [],
		});

		expect(data?.inProgressQuizId).toBe("mine");
		expect(data?.revisions).toHaveLength(1);
	});
});
