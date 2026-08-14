import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { FolderId } from "@/domain/folder/folder";
import {
	publishQuizSet,
	type QuizSetId,
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
import { CreateFolder, FolderNotFoundError } from "../folders/create-folder";
import { MoveQuizSet } from "./move-quiz-set";

let context: TestContext;
let moveQuizSet: MoveQuizSet;
let createFolder: CreateFolder;

beforeEach(() => {
	context = createTestContext();
	createFolder = new CreateFolder({
		folders: context.folders,
		clock: context.clock,
		idGenerator: context.idGenerator,
		transaction: context.transaction,
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

const storedSet = (published = false): QuizSetId => {
	const draft = aQuizSet({ id: "set-1", questions: [aQuestion({ id: "q1" })] });
	const quizSet = published
		? publishQuizSet(draft, context.clock.now())
		: draft;

	context.quizSets.save(quizSet);

	return quizSet.id;
};

const folderOf = (quizSetId: QuizSetId): FolderId | undefined =>
	context.quizSets.findById(quizSetId)?.folderId;

describe("MoveQuizSet", () => {
	test("files a set into a folder", async () => {
		const quizSetId = storedSet();
		const { folderId } = await createFolder.execute({ name: "English" });

		await moveQuizSet.execute({ quizSetId, folderId });

		expect(folderOf(quizSetId)).toBe(folderId);
	});

	test("files a published set", async () => {
		const quizSetId = storedSet(true);
		const { folderId } = await createFolder.execute({ name: "English" });

		await moveQuizSet.execute({ quizSetId, folderId });

		expect(folderOf(quizSetId)).toBe(folderId);
		expect(context.quizSets.findById(quizSetId)?.status).toBe(
			QuizSetStatus.Published,
		);
	});

	test("returns a set to unfiled", async () => {
		const quizSetId = storedSet();
		const { folderId } = await createFolder.execute({ name: "English" });
		await moveQuizSet.execute({ quizSetId, folderId });

		await moveQuizSet.execute({ quizSetId, folderId: undefined });

		expect(folderOf(quizSetId)).toBeUndefined();
	});

	test("rejects an unknown folder", () => {
		const quizSetId = storedSet();

		expect(
			moveQuizSet.execute({ quizSetId, folderId: "missing" as FolderId }),
		).rejects.toBeInstanceOf(FolderNotFoundError);
	});

	test("rejects an unknown set", async () => {
		const { folderId } = await createFolder.execute({ name: "English" });

		expect(
			moveQuizSet.execute({ quizSetId: "missing" as QuizSetId, folderId }),
		).rejects.toBeInstanceOf(Error);
	});
});
