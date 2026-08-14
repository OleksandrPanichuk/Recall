import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { FolderId } from "@/domain/folder/folder";
import {
	archiveQuizSet,
	publishQuizSet,
	type QuizSet,
	QuizSetStatus,
} from "@/domain/quiz-set/quiz-set";
import {
	createTestContext,
	type TestContext,
} from "../../../../tests/fixtures/application.fixture";
import {
	aQuestion,
	aQuizSet,
} from "../../../../tests/fixtures/quiz-set.fixture";
import { MoveQuizSet } from "../quiz-sets/move-quiz-set";
import { BrowseFolder } from "./browse-folder";
import { CreateFolder } from "./create-folder";
import { DeleteFolder, FolderNotEmptyError } from "./delete-folder";

let context: TestContext;
let browseFolder: BrowseFolder;
let createFolder: CreateFolder;
let deleteFolder: DeleteFolder;
let moveQuizSet: MoveQuizSet;

beforeEach(() => {
	context = createTestContext();

	const dependencies = {
		folders: context.folders,
		clock: context.clock,
		idGenerator: context.idGenerator,
		transaction: context.transaction,
	};

	createFolder = new CreateFolder(dependencies);
	deleteFolder = new DeleteFolder(dependencies);
	browseFolder = new BrowseFolder({
		folders: context.folders,
		quizSets: context.quizSets,
	});
	moveQuizSet = new MoveQuizSet({
		quizSets: context.quizSets,
		folders: context.folders,
		clock: context.clock,
	});
});

afterEach(() => {
	context.close();
});

const create = async (name: string, parentId?: FolderId): Promise<FolderId> =>
	(await createFolder.execute({ name, parentId })).folderId;

const store = (
	id: string,
	status: QuizSetStatus = QuizSetStatus.Published,
): QuizSet => {
	const draft = aQuizSet({ id, questions: [aQuestion({ id: `${id}-q` })] });
	const at = context.clock.now();
	const quizSet =
		status === QuizSetStatus.Published
			? publishQuizSet(draft, at)
			: status === QuizSetStatus.Archived
				? archiveQuizSet(draft, at)
				: draft;

	context.quizSets.save(quizSet);

	return quizSet;
};

const fileInto = async (id: string, folderId: FolderId): Promise<void> => {
	const quizSet = store(id);

	await moveQuizSet.execute({ quizSetId: quizSet.id, folderId });
};

const titles = (sets: readonly { readonly id: string }[]): readonly string[] =>
	sets.map((set) => String(set.id));

describe("list filtering", () => {
	test("returns the sets of one folder only", async () => {
		const english = await create("English");
		const programming = await create("Programming");
		await fileInto("set-english", english);
		await fileInto("set-programming", programming);

		expect(titles(context.quizSets.list({ folderId: english }))).toEqual([
			"set-english",
		]);
	});

	test("returns unfiled sets when asked for null", async () => {
		const english = await create("English");
		await fileInto("set-english", english);
		store("set-loose");

		expect(titles(context.quizSets.list({ folderId: null }))).toEqual([
			"set-loose",
		]);
	});

	test("returns every set when no folder is named", async () => {
		const english = await create("English");
		await fileInto("set-english", english);
		store("set-loose");

		expect(context.quizSets.list()).toHaveLength(2);
	});
});

describe("BrowseFolder at the root", () => {
	test("returns root folders, unfiled sets and an empty breadcrumb", async () => {
		await create("English");
		await create("Programming");
		store("set-loose");

		const view = await browseFolder.execute({ folderId: undefined });

		expect(view.breadcrumb).toEqual([]);
		expect(view.folderId).toBeUndefined();
		expect(view.parentId).toBeUndefined();
		expect(view.children.map((child) => child.name)).toEqual([
			"English",
			"Programming",
		]);
		expect(titles(view.sets)).toEqual(["set-loose"]);
	});

	test("does not show a set that is filed inside a folder", async () => {
		const english = await create("English");
		await fileInto("set-english", english);

		const view = await browseFolder.execute({ folderId: undefined });

		expect(view.sets).toEqual([]);
	});

	test("counts only published sets on a child", async () => {
		const english = await create("English");
		await fileInto("set-published", english);
		const draft = store("set-draft", QuizSetStatus.Draft);
		await moveQuizSet.execute({ quizSetId: draft.id, folderId: english });

		const view = await browseFolder.execute({ folderId: undefined });

		expect(view.children[0]?.setCount).toBe(1);
	});
});

describe("BrowseFolder inside a folder", () => {
	test("returns the breadcrumb, the children and its own sets", async () => {
		const english = await create("English");
		const vocabulary = await create("Vocabulary", english);
		await create("By levels", vocabulary);
		await fileInto("set-vocab", vocabulary);

		const view = await browseFolder.execute({ folderId: vocabulary });

		expect(view.name).toBe("Vocabulary");
		expect(view.breadcrumb.map((crumb) => crumb.name)).toEqual(["English"]);
		expect(view.children.map((child) => child.name)).toEqual(["By levels"]);
		expect(titles(view.sets)).toEqual(["set-vocab"]);
	});

	test("reports the parent so the caller can offer a way back", async () => {
		const english = await create("English");
		const vocabulary = await create("Vocabulary", english);

		expect(
			(await browseFolder.execute({ folderId: vocabulary })).parentId,
		).toBe(english);
	});

	test("reports no parent for a root folder", async () => {
		const english = await create("English");

		expect((await browseFolder.execute({ folderId: english })).parentId).toBe(
			undefined,
		);
	});

	test("hides drafts and archived sets", async () => {
		const english = await create("English");
		const draft = store("set-draft", QuizSetStatus.Draft);
		const archived = store("set-archived", QuizSetStatus.Archived);
		await moveQuizSet.execute({ quizSetId: draft.id, folderId: english });
		await moveQuizSet.execute({ quizSetId: archived.id, folderId: english });

		expect((await browseFolder.execute({ folderId: english })).sets).toEqual(
			[],
		);
	});

	test("rejects an unknown folder", () => {
		expect(
			browseFolder.execute({ folderId: "missing" as FolderId }),
		).rejects.toBeInstanceOf(Error);
	});
});

describe("DeleteFolder with sets", () => {
	test("refuses a folder that still holds a set", async () => {
		const english = await create("English");
		await fileInto("set-english", english);

		expect(deleteFolder.execute({ folderId: english })).rejects.toBeInstanceOf(
			FolderNotEmptyError,
		);
	});

	test("refuses a folder that holds only a draft", async () => {
		const english = await create("English");
		const draft = store("set-draft", QuizSetStatus.Draft);
		await moveQuizSet.execute({ quizSetId: draft.id, folderId: english });

		expect(deleteFolder.execute({ folderId: english })).rejects.toBeInstanceOf(
			FolderNotEmptyError,
		);
	});
});
