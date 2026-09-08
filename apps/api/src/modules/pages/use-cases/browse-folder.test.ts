import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createMemoryContext,
	type MemoryContext,
} from "@tests/fixtures/memory.fixture";
import { quizzesOver } from "@tests/fixtures/quizzes.use-cases";
import {
	CreatePageUseCase,
	DeletePageUseCase,
	FolderNotEmptyError,
	type PageId,
	PagesService,
} from "@/modules/pages";
import {
	MoveQuizSetUseCase,
	QuizSetEntity,
	QuizSetStatus,
} from "@/modules/quizzes";
import {
	aQuestion,
	aQuizSet,
} from "../../../../tests/fixtures/quiz-set.fixture";
import { BrowseFolderUseCase } from "./browse-folder";

let context: MemoryContext;
let browseFolder: BrowseFolderUseCase;
let createFolder: CreatePageUseCase;
let deleteFolder: DeletePageUseCase;
let moveQuizSet: MoveQuizSetUseCase;

beforeEach(() => {
	context = createMemoryContext();

	createFolder = new CreatePageUseCase(
		context.scope.pages,
		new PagesService(context.scope.pages),
		context.transaction,
		context.clock,
		context.idGenerator,
	);
	deleteFolder = new DeletePageUseCase(
		context.scope.pages,
		new PagesService(context.scope.pages),
		context.transaction,
	);
	browseFolder = new BrowseFolderUseCase(
		context.scope.pages,
		new PagesService(context.scope.pages),
	);
	moveQuizSet = quizzesOver(context).moveQuizSet;
});

afterEach(() => {
	context.close();
});

const create = async (name: string, parentId?: PageId): Promise<PageId> =>
	(await createFolder.execute({ name, parentId })).folderId;

const store = async (
	id: string,
	status: QuizSetStatus = QuizSetStatus.Published,
): Promise<QuizSetEntity> => {
	const draft = aQuizSet({ id, questions: [aQuestion({ id: `${id}-q` })] });
	const at = context.clock.now();
	const quizSet =
		status === QuizSetStatus.Published
			? QuizSetEntity.publish(draft, at)
			: status === QuizSetStatus.Archived
				? QuizSetEntity.archive(draft, at)
				: draft;

	await context.unitOfWork.run(({ quizzes }) => quizzes.save(quizSet));

	return quizSet;
};

const fileInto = async (id: string, folderId: PageId): Promise<void> => {
	const quizSet = await store(id);

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

		expect(
			titles(await context.scope.quizzes.list({ pageId: english })),
		).toEqual(["set-english"]);
	});

	test("returns unfiled sets when asked for null", async () => {
		const english = await create("English");
		await fileInto("set-english", english);
		await store("set-loose");

		expect(titles(await context.scope.quizzes.list({ pageId: null }))).toEqual([
			"set-loose",
		]);
	});

	test("returns every set when no folder is named", async () => {
		const english = await create("English");
		await fileInto("set-english", english);
		await store("set-loose");

		expect(await context.scope.quizzes.list()).toHaveLength(2);
	});
});

describe("BrowseFolderUseCase at the root", () => {
	test("returns root folders, unfiled sets and an empty breadcrumb", async () => {
		await create("English");
		await create("Programming");
		await store("set-loose");

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
		const draft = await store("set-draft", QuizSetStatus.Draft);
		const archived = await store("set-archived", QuizSetStatus.Archived);
		await moveQuizSet.execute({ quizSetId: draft.id, folderId: english });
		await moveQuizSet.execute({ quizSetId: archived.id, folderId: english });

		const view = await browseFolder.execute({ folderId: undefined });

		expect(view.children[0]?.itemCount).toBe(1);
	});

	test("counts the subfolders of a child that holds no set", async () => {
		const english = await create("English");
		await create("Vocabulary", english);

		const view = await browseFolder.execute({ folderId: undefined });

		expect(view.children[0]?.itemCount).toBe(1);
	});

	test("adds the subfolders of a child to its published sets", async () => {
		const english = await create("English");
		await create("Vocabulary", english);
		await create("Grammar", english);
		await fileInto("set-published", english);

		const view = await browseFolder.execute({ folderId: undefined });

		expect(view.children[0]?.itemCount).toBe(3);
	});

	test("counts only the direct subfolders of a child", async () => {
		const english = await create("English");
		const vocabulary = await create("Vocabulary", english);
		await create("By levels", vocabulary);

		const view = await browseFolder.execute({ folderId: undefined });

		expect(view.children[0]?.itemCount).toBe(1);
	});
});

describe("BrowseFolderUseCase inside a folder", () => {
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

	test("counts the items of a child that is itself nested", async () => {
		const english = await create("English");
		const vocabulary = await create("Vocabulary", english);
		await create("By levels", vocabulary);
		await fileInto("set-vocab", vocabulary);

		const view = await browseFolder.execute({ folderId: english });

		expect(view.children[0]?.itemCount).toBe(2);
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
		const draft = await store("set-draft", QuizSetStatus.Draft);
		const archived = await store("set-archived", QuizSetStatus.Archived);
		await moveQuizSet.execute({ quizSetId: draft.id, folderId: english });
		await moveQuizSet.execute({ quizSetId: archived.id, folderId: english });

		expect((await browseFolder.execute({ folderId: english })).sets).toEqual(
			[],
		);
	});

	test("rejects an unknown folder", () => {
		expect(
			browseFolder.execute({ folderId: "missing" as PageId }),
		).rejects.toBeInstanceOf(Error);
	});
});

describe("DeletePageUseCase with sets", () => {
	test("refuses a folder that still holds a set", async () => {
		const english = await create("English");
		await fileInto("set-english", english);

		expect(deleteFolder.execute({ folderId: english })).rejects.toBeInstanceOf(
			FolderNotEmptyError,
		);
	});

	test("refuses a folder that holds only a draft", async () => {
		const english = await create("English");
		const draft = await store("set-draft", QuizSetStatus.Draft);
		await moveQuizSet.execute({ quizSetId: draft.id, folderId: english });

		expect(deleteFolder.execute({ folderId: english })).rejects.toBeInstanceOf(
			FolderNotEmptyError,
		);
	});
});
