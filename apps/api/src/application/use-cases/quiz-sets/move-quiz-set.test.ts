import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	createMemoryContext,
	type MemoryContext,
} from "@tests/fixtures/memory.fixture";
import type { FolderId } from "@/domain/folder/folder";
import {
	publishQuizSet,
	type QuizSetId,
	QuizSetStatus,
} from "@/domain/quiz-set/quiz-set";
import {
	aQuestion,
	aQuizSet,
} from "../../../../tests/fixtures/quiz-set.fixture";
import {
	CreateFolderUseCase,
	FolderNotFoundError,
} from "../folders/create-folder";
import { CreateQuizSetUseCase } from "./create-quiz-set";
import { MoveQuizSetUseCase } from "./move-quiz-set";

let context: MemoryContext;
let moveQuizSet: MoveQuizSetUseCase;
let createFolder: CreateFolderUseCase;

beforeEach(() => {
	context = createMemoryContext();
	createFolder = new CreateFolderUseCase(context);
	moveQuizSet = new MoveQuizSetUseCase(context);
});

afterEach(() => {
	context.close();
});

const storedSet = async (published = false): Promise<QuizSetId> => {
	const draft = aQuizSet({ id: "set-1", questions: [aQuestion({ id: "q1" })] });
	const quizSet = published
		? publishQuizSet(draft, context.clock.now())
		: draft;

	await context.unitOfWork.run(({ quizzes }) => quizzes.save(quizSet));

	return quizSet.id;
};

const folderOf = async (quizSetId: QuizSetId): Promise<FolderId | undefined> =>
	(await context.scope.quizzes.findById(quizSetId))?.folderId;

describe("MoveQuizSetUseCase", () => {
	test("files a set into a folder", async () => {
		const quizSetId = await storedSet();
		const { folderId } = await createFolder.execute({ name: "English" });

		await moveQuizSet.execute({ quizSetId, folderId });

		expect(await folderOf(quizSetId)).toBe(folderId);
	});

	test("files a published set", async () => {
		const quizSetId = await storedSet(true);
		const { folderId } = await createFolder.execute({ name: "English" });

		await moveQuizSet.execute({ quizSetId, folderId });

		expect(await folderOf(quizSetId)).toBe(folderId);
		expect((await context.scope.quizzes.findById(quizSetId))?.status).toBe(
			QuizSetStatus.Published,
		);
	});

	test("returns a set to unfiled", async () => {
		const quizSetId = await storedSet();
		const { folderId } = await createFolder.execute({ name: "English" });
		await moveQuizSet.execute({ quizSetId, folderId });

		await moveQuizSet.execute({ quizSetId, folderId: undefined });

		expect(await folderOf(quizSetId)).toBeUndefined();
	});

	test("rejects an unknown folder", async () => {
		const quizSetId = await storedSet();

		await expect(
			moveQuizSet.execute({ quizSetId, folderId: "missing" as FolderId }),
		).rejects.toBeInstanceOf(FolderNotFoundError);
	});

	test("rejects a set created into an unknown folder", async () => {
		const createQuizSet = new CreateQuizSetUseCase(context);

		await expect(
			createQuizSet.execute({
				title: "T",
				language: "uk",
				folderId: "missing" as FolderId,
			}),
		).rejects.toBeInstanceOf(FolderNotFoundError);
	});

	test("rejects an unknown set", async () => {
		const { folderId } = await createFolder.execute({ name: "English" });

		expect(
			moveQuizSet.execute({ quizSetId: "missing" as QuizSetId, folderId }),
		).rejects.toBeInstanceOf(Error);
	});
});
