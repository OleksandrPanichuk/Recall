import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createDrizzleClient } from "@/adapters/persistence/sqlite/database";
import { createSqliteFolderRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-folder.repository";
import { createSqliteQuizSetRepository } from "@/adapters/persistence/sqlite/repositories/sqlite-quiz-set.repository";
import { createSqliteTransaction } from "@/adapters/persistence/sqlite/sqlite-transaction";
import type { FolderRepository } from "@/application/ports/repositories/folder.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import { createFolder, type Folder, toFolderId } from "@/domain/folder/folder";
import { QuizSetStatus, toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { aQuestion, aQuizSet } from "../../fixtures/quiz-set.fixture";
import { countRows, openMigratedDatabase } from "./migrated-database";

const at = (iso: string): Date => new Date(iso);
const createdAt = at("2026-08-01T00:00:00.000Z");

let database: Database;
let folders: FolderRepository;
let quizSets: QuizSetRepository;

beforeEach(() => {
	database = openMigratedDatabase();

	const client = createDrizzleClient(database);
	const transaction = createSqliteTransaction(client);

	folders = createSqliteFolderRepository(client, transaction);
	quizSets = createSqliteQuizSetRepository(client, transaction);
});

afterEach(() => {
	database.close();
});

const aFolder = (id: string, name: string, parentId?: string): Folder =>
	createFolder({
		id: toFolderId(id),
		name,
		parentId: parentId === undefined ? undefined : toFolderId(parentId),
		createdAt,
	});

const seedChain = (): void => {
	folders.save(aFolder("english", "English"));
	folders.save(aFolder("vocab", "Vocabulary", "english"));
	folders.save(aFolder("levels", "By levels", "vocab"));
};

const namesOf = (list: readonly Folder[]): readonly string[] =>
	list.map((folder) => folder.name);

describe("SqliteFolderRepository", () => {
	describe("save and findById", () => {
		test("round-trips a root folder", () => {
			const folder = aFolder("english", "English");

			folders.save(folder);

			expect(folders.findById(folder.id)).toEqual(folder);
		});

		test("round-trips a child folder", () => {
			folders.save(aFolder("english", "English"));
			const child = aFolder("vocab", "Vocabulary", "english");

			folders.save(child);

			expect(folders.findById(child.id)).toEqual(child);
		});

		test("returns undefined for an unknown id", () => {
			expect(folders.findById(toFolderId("missing"))).toBeUndefined();
		});

		test("refuses two root folders with the same name", () => {
			folders.save(aFolder("english", "English"));

			expect(() => {
				folders.save(aFolder("english-2", "English"));
			}).toThrow();
		});

		test("refuses two siblings with the same name", () => {
			folders.save(aFolder("english", "English"));
			folders.save(aFolder("vocab", "Vocabulary", "english"));

			expect(() => {
				folders.save(aFolder("vocab-2", "Vocabulary", "english"));
			}).toThrow();
		});

		test("allows the same name under different parents", () => {
			folders.save(aFolder("english", "English"));
			folders.save(aFolder("prog", "Programming"));
			folders.save(aFolder("b1", "Basics", "english"));

			folders.save(aFolder("b2", "Basics", "prog"));

			expect(folders.findById(toFolderId("b2"))?.name).toBe("Basics");
		});

		test("saving twice updates rather than duplicating", () => {
			const folder = aFolder("english", "English");
			folders.save(folder);

			folders.save({
				...folder,
				name: "Англійська",
				updatedAt: at("2026-08-02T00:00:00.000Z"),
			});

			expect(countRows(database, "folders")).toBe(1);
			expect(folders.findById(folder.id)?.name).toBe("Англійська");
		});
	});

	describe("listChildren", () => {
		test("returns roots, name-ordered, when asked for the root", () => {
			folders.save(aFolder("prog", "Programming"));
			folders.save(aFolder("english", "English"));
			folders.save(aFolder("vocab", "Vocabulary", "english"));

			expect(namesOf(folders.listChildren(undefined))).toEqual([
				"English",
				"Programming",
			]);
		});

		test("returns direct children only", () => {
			seedChain();

			expect(namesOf(folders.listChildren(toFolderId("english")))).toEqual([
				"Vocabulary",
			]);
		});

		test("returns nothing for a leaf", () => {
			seedChain();

			expect(folders.listChildren(toFolderId("levels"))).toEqual([]);
		});
	});

	describe("listAncestors", () => {
		test("returns the chain root-first, excluding the folder itself", () => {
			seedChain();

			expect(namesOf(folders.listAncestors(toFolderId("levels")))).toEqual([
				"English",
				"Vocabulary",
			]);
		});

		test("is empty for a root folder", () => {
			seedChain();

			expect(folders.listAncestors(toFolderId("english"))).toEqual([]);
		});

		test("is empty for an unknown folder", () => {
			expect(folders.listAncestors(toFolderId("missing"))).toEqual([]);
		});
	});

	describe("listAll", () => {
		test("returns every folder", () => {
			seedChain();

			expect(folders.listAll()).toHaveLength(3);
		});
	});

	describe("countSetsIn", () => {
		const publishedSetIn = (folderId: string, id: string): void => {
			const draft = aQuizSet({
				id,
				questions: [aQuestion({ id: `${id}-q` })],
			});

			quizSets.save({
				...draft,
				folderId: toFolderId(folderId),
				status: QuizSetStatus.Published,
				publishedAt: createdAt,
			});
		};

		test("counts only sets filed in that folder", () => {
			seedChain();
			publishedSetIn("levels", "set-1");
			publishedSetIn("levels", "set-2");
			publishedSetIn("english", "set-3");

			expect(folders.countSetsIn(toFolderId("levels"))).toBe(2);
		});

		test("reads a filed set back with its folder", () => {
			seedChain();
			publishedSetIn("levels", "set-1");

			expect(quizSets.findById(toQuizSetId("set-1"))?.folderId).toBe(
				toFolderId("levels"),
			);
		});

		test("counts nothing for an empty folder", () => {
			seedChain();

			expect(folders.countSetsIn(toFolderId("levels"))).toBe(0);
		});

		test("filters by status when asked", () => {
			seedChain();
			quizSets.save({
				...aQuizSet({ id: "draft-set", questions: [aQuestion({ id: "dq" })] }),
				folderId: toFolderId("levels"),
			});

			expect(folders.countSetsIn(toFolderId("levels"))).toBe(1);
			expect(
				folders.countSetsIn(toFolderId("levels"), [QuizSetStatus.Published]),
			).toBe(0);
		});
	});

	describe("delete", () => {
		test("removes an empty leaf", () => {
			seedChain();

			folders.delete(toFolderId("levels"));

			expect(folders.findById(toFolderId("levels"))).toBeUndefined();
			expect(countRows(database, "folders")).toBe(2);
		});

		test("refuses a folder that still has a child", () => {
			seedChain();

			expect(() => {
				folders.delete(toFolderId("english"));
			}).toThrow();
			expect(folders.findById(toFolderId("english"))).toBeDefined();
		});

		test("refuses a folder that still holds a set", () => {
			seedChain();
			quizSets.save({
				...aQuizSet({ id: "set-1", questions: [aQuestion({ id: "q1" })] }),
				folderId: toFolderId("levels"),
			});

			expect(() => {
				folders.delete(toFolderId("levels"));
			}).toThrow();
		});

		test("deleting an emptied folder leaves its former set intact", () => {
			seedChain();
			const draft = aQuizSet({
				id: "set-1",
				questions: [aQuestion({ id: "q1" })],
			});
			quizSets.save({ ...draft, folderId: toFolderId("levels") });

			quizSets.save({ ...draft, folderId: undefined });
			folders.delete(toFolderId("levels"));

			expect(quizSets.findById(draft.id)?.questions).toHaveLength(1);
			expect(quizSets.findById(draft.id)?.folderId).toBeUndefined();
		});
	});
});
