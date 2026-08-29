import { describe, expect, test } from "bun:test";
import type { BrowseView } from "@recall/contracts";
import { QuizSetStatus } from "@recall/contracts";
import { CallbackAction } from "../callbacks/callback-data.constants";
import { browseScreen, SUMMARY_EXCERPT } from "./browse.presenter";

const aView = (titles: readonly string[]): BrowseView => ({
	breadcrumb: [],
	children: [],
	attached: [],
	sets: titles.map((title, index) => ({
		id: `set-${index}`,
		title,
		status: QuizSetStatus.Published,
		questionCount: 52,
		updatedAt: "2026-08-20T00:00:00.000Z",
	})),
});

const labelsOf = (titles: readonly string[]): readonly string[] =>
	browseScreen(aView(titles), CallbackAction.StartSet, 0)
		.keyboard.flat()
		.map((entry) => entry.text);

describe("set labels in the list", () => {
	test("keeps a whole title, including the question count", () => {
		expect(labelsOf(["A1 Food Vocabulary"])).toContainEqual(
			"📘 A1 Food Vocabulary (52)",
		);
	});

	test("clips only a title that genuinely does not fit", () => {
		const [label] = labelsOf([
			"DDIA — Chapter 2: Data Models and Query Languages",
		]);

		expect(label).toContain("…");
		expect([...(label as string)].length).toBeLessThanOrEqual(32);
	});

	test("does not clip a title an option button would have moved aside", () => {
		expect(labelsOf(["Twenty four characters!!"])).toContainEqual(
			"📘 Twenty four characters!! (52)",
		);
	});
});

describe("a page's summary", () => {
	const aPage = (summary?: string, icon?: string): BrowseView => ({
		folderId: "folder-1",
		name: "Chapter 1",
		summary,
		icon,
		breadcrumb: [{ id: "folder-0", name: "Biology" }],
		children: [],
		sets: [],
		attached: [],
	});

	const textOf = (view: BrowseView): string =>
		browseScreen(view, CallbackAction.StartSet, 0).text;

	test("sits between the breadcrumb and the folder contents", () => {
		expect(textOf(aPage("Every living thing is made of cells."))).toBe(
			"Biology › Chapter 1\n\nEvery living thing is made of cells.\n\nЦя папка порожня.",
		);
	});

	test("is clipped, with a pointer to the web, when it is long", () => {
		const text = textOf(aPage("щ".repeat(SUMMARY_EXCERPT + 1)));

		expect(text).toContain("…");
		expect(text).toContain("Читати повністю у вебі.");
	});

	test("is absent when the page has none", () => {
		expect(textOf(aPage())).toBe("Biology › Chapter 1\n\nЦя папка порожня.");
	});

	test("puts the page icon in front of the breadcrumb", () => {
		expect(textOf(aPage(undefined, "🧬"))).toStartWith(
			"🧬 Biology › Chapter 1",
		);
	});
});
