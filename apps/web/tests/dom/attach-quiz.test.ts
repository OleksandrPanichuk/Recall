import { describe, expect, test } from "bun:test";
import type { BrowseView, QuizSummary } from "@recall/contracts";
import { attachableTo } from "@/features/pages/ui/components/AttachQuiz/AttachQuiz.lib";

const summary = (id: string, title: string): QuizSummary => ({
	id,
	title,
	status: "published",
	questionCount: 3,
	updatedAt: "2026-01-01T00:00:00.000Z",
});

const page = (
	sets: readonly QuizSummary[],
	attached: readonly QuizSummary[],
): BrowseView => ({
	folderId: "page",
	name: "Runtimes",
	breadcrumb: [],
	children: [],
	sets,
	attached,
});

const library = [
	summary("bun", "Bun basics"),
	summary("sql", "SQL joins"),
	summary("http", "HTTP verbs"),
];

describe("which quizzes a page can still be given", () => {
	test("everything, when the page holds none", () => {
		expect(attachableTo(page([], []), library).map((set) => set.id)).toEqual([
			"bun",
			"sql",
			"http",
		]);
	});

	test("never one that already lives in the page", () => {
		expect(
			attachableTo(page([summary("bun", "Bun basics")], []), library).map(
				(set) => set.id,
			),
		).toEqual(["sql", "http"]);
	});

	test("never one already attached, so a link cannot be offered twice", () => {
		expect(
			attachableTo(page([], [summary("sql", "SQL joins")]), library).map(
				(set) => set.id,
			),
		).toEqual(["bun", "http"]);
	});

	test("nothing at all, once the page holds every quiz", () => {
		expect(attachableTo(page(library, []), library)).toEqual([]);
	});
});
