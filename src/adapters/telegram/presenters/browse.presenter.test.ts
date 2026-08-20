import { describe, expect, test } from "bun:test";
import type { BrowseView } from "@/application/use-cases/folders/browse-folder";
import { QuizSetStatus, toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { CallbackAction } from "../callbacks/callback-data.constants";
import { browseScreen } from "./browse.presenter";

const aView = (titles: readonly string[]): BrowseView => ({
	breadcrumb: [],
	children: [],
	sets: titles.map((title, index) => ({
		id: toQuizSetId(`set-${index}`),
		title,
		status: QuizSetStatus.Published,
		questionCount: 52,
		updatedAt: new Date("2026-08-20T00:00:00.000Z"),
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
