import { describe, expect, test } from "bun:test";
import { renderToString } from "react-dom/server";
import type { FolderView, QuizSettings, SetSummary } from "../client";
import { FoldersPage } from "./folders-view";
import { emptyDraft, QuestionEditor } from "./question-editor";
import { SetPage } from "./set-view";
import { SetsPage } from "./sets-view";
import { SettingsPage } from "./settings-view";

const FOLDERS: readonly FolderView[] = [
	{
		id: "f1",
		name: "Books",
		parentId: null,
		depth: 0,
		setCount: 2,
		unpublishedCount: 1,
	},
	{
		id: "f2",
		name: "DDIA",
		parentId: "f1",
		depth: 1,
		setCount: 2,
		unpublishedCount: 0,
	},
];

const SETS: readonly SetSummary[] = [
	{ id: "s1", title: "Chapter 01", status: "published", questionCount: 25 },
	{ id: "s2", title: "Draft", status: "draft", questionCount: 0 },
];

const SETTINGS: QuizSettings = {
	repetition: {
		intervalsDays: [1, 3, 7],
		maxIntervalDays: 180,
		maxRepetitions: 8,
	},
	shuffleOptions: true,
	shuffleQuestions: false,
	examMode: false,
};

const nothing = () => {
	return;
};

describe("the admin pages", () => {
	test("render the set list with its folders", () => {
		const html = renderToString(
			<SetsPage
				sets={SETS}
				folders={FOLDERS}
				onOpen={nothing}
				onChanged={nothing}
			/>,
		);

		expect(html).toContain("Chapter 01");
		expect(html).toContain("питань");
		expect(html).toContain("published");
		expect(html).toContain("DDIA");
	});

	test("render the folder tree with its counts", () => {
		const html = renderToString(
			<FoldersPage folders={FOLDERS} onChanged={nothing} />,
		);

		expect(html).toContain("Books");
		expect(html).toContain("опубл.");
		expect(html).toContain("чернеток");
	});

	test("render the settings with the current values", () => {
		const html = renderToString(
			<SettingsPage settings={SETTINGS} source="global" onChanged={nothing} />,
		);

		expect(html).toContain("global");
		expect(html).toContain("1, 3, 7");
		expect(html).toContain("180");
	});

	test("render the set page before its data arrives", () => {
		const html = renderToString(
			<SetPage
				quizSetId="s1"
				folders={FOLDERS}
				onChanged={nothing}
				onClose={nothing}
			/>,
		);

		expect(html).toContain("Завантаження");
	});

	test("render the question editor", () => {
		const html = renderToString(
			<QuestionEditor draft={emptyDraft()} onChange={nothing} />,
		);

		expect(html).toContain("Варіанти");
		expect(html).toContain("single_choice");
	});
});
