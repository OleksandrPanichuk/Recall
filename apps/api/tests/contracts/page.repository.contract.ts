import { beforeEach, describe, expect, test } from "bun:test";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import {
	createFolder,
	renameFolder,
	toFolderId,
	writeSummary,
} from "@/domain/folder/folder";
import { type QuizSetStatus, toQuizSetId } from "@/domain/quiz-set/quiz-set";

export interface PageRepositoryHarness {
	readonly unitOfWork: UnitOfWork<RepositoryScope>;
	readonly scope: RepositoryScope;
	reset(): Promise<void>;
	seedQuiz(pageId: string, status: QuizSetStatus): Promise<string>;
}

const at = new Date("2026-08-01T10:00:00.000Z");
const later = new Date("2026-08-02T10:00:00.000Z");

const page = (id: string, name: string, parentId?: string) =>
	createFolder({
		id: toFolderId(id),
		name,
		parentId: parentId === undefined ? undefined : toFolderId(parentId),
		createdAt: at,
	});

const uuid = (): string => crypto.randomUUID();

export function describePageRepository(
	implementation: string,
	open: () => PageRepositoryHarness,
	options: { readonly skip?: boolean } = {},
): void {
	describe.skipIf(options.skip === true)(
		`the ${implementation} page repository`,
		() => {
			let harness: PageRepositoryHarness;

			beforeEach(async () => {
				harness = open();
				await harness.reset();
			});

			test("saves a page and reads it back", async () => {
				const id = uuid();

				await harness.unitOfWork.run(async ({ pages }) => {
					await pages.save(page(id, "Programming"));
				});

				const stored = await harness.scope.pages.findById(toFolderId(id));

				expect(stored?.name).toBe("Programming");
				expect(stored?.parentId).toBeUndefined();
			});

			test("treats an id that is not a uuid as missing, not as an error", async () => {
				const missing = toFolderId("does-not-exist");

				expect(await harness.scope.pages.findById(missing)).toBeUndefined();
				expect(await harness.scope.pages.listChildren(missing)).toEqual([]);
				expect(await harness.scope.pages.listAncestors(missing)).toEqual([]);
				expect(await harness.scope.pages.countQuizzesIn(missing)).toBe(0);
				expect(await harness.scope.pages.countChildPages(missing)).toBe(0);
			});

			test("lists children in name order", async () => {
				const root = uuid();

				await harness.unitOfWork.run(async ({ pages }) => {
					await pages.save(page(root, "Books"));
					await pages.save(page(uuid(), "Zebra", root));
					await pages.save(page(uuid(), "Alpha", root));
				});

				const children = await harness.scope.pages.listChildren(
					toFolderId(root),
				);

				expect(children.map((child) => child.name)).toEqual(["Alpha", "Zebra"]);
			});

			test("walks ancestors from the leaf up", async () => {
				const top = uuid();
				const middle = uuid();
				const leaf = uuid();

				await harness.unitOfWork.run(async ({ pages }) => {
					await pages.save(page(top, "Programming"));
					await pages.save(page(middle, "Books", top));
					await pages.save(page(leaf, "DDIA", middle));
				});

				const ancestors = await harness.scope.pages.listAncestors(
					toFolderId(leaf),
				);

				expect(ancestors.map((entry) => entry.name)).toEqual([
					"Programming",
					"Books",
				]);
			});

			test("updates a page in place on rename", async () => {
				const id = uuid();

				await harness.unitOfWork.run(async ({ pages }) => {
					await pages.save(page(id, "Programing"));
				});

				await harness.unitOfWork.run(async ({ pages }) => {
					const stored = await pages.findById(toFolderId(id));

					if (stored === undefined) {
						throw new Error("the page vanished");
					}

					await pages.save(renameFolder(stored, "Programming", at));
				});

				const all = await harness.scope.pages.listAll();

				expect(all).toHaveLength(1);
				expect(all[0]?.name).toBe("Programming");
			});

			test("counts child pages", async () => {
				const root = uuid();

				await harness.unitOfWork.run(async ({ pages }) => {
					await pages.save(page(root, "Books"));
					await pages.save(page(uuid(), "One", root));
					await pages.save(page(uuid(), "Two", root));
				});

				expect(
					await harness.scope.pages.countChildPages(toFolderId(root)),
				).toBe(2);
			});

			test("counts quizzes filed under a page, by status", async () => {
				const id = uuid();

				await harness.unitOfWork.run(async ({ pages }) => {
					await pages.save(page(id, "Books"));
				});

				await harness.seedQuiz(id, "published");
				await harness.seedQuiz(id, "draft");

				expect(await harness.scope.pages.countQuizzesIn(toFolderId(id))).toBe(
					2,
				);
				expect(
					await harness.scope.pages.countQuizzesIn(toFolderId(id), [
						"published",
					]),
				).toBe(1);
			});

			test("rolls the whole boundary back when the operation throws", async () => {
				const first = uuid();

				let failed = false;

				try {
					await harness.unitOfWork.run(async ({ pages }) => {
						await pages.save(page(first, "Kept"));
						await pages.save(page(uuid(), "Lost", first));

						throw new Error("give it all back");
					});
				} catch (error) {
					failed = (error as Error).message.includes("give it all back");
				}

				expect(failed).toBe(true);
				expect(await harness.scope.pages.listAll()).toEqual([]);
			});

			test("refuses two children of one parent with the same slug", async () => {
				const root = uuid();

				await harness.unitOfWork.run(async ({ pages }) => {
					await pages.save(page(root, "Books"));
					await pages.save(page(uuid(), "Chapter One", root));
				});

				let reported = "";

				try {
					await harness.unitOfWork.run(async ({ pages }) => {
						await pages.save(page(uuid(), "chapter one", root));
					});
				} catch (error) {
					const failure = error as Error & { cause?: Error };

					reported = `${failure.message} ${failure.cause?.message ?? ""}`;
				}

				expect(reported).toContain("pages_parent_slug_unique");
			});

			test("deletes a page", async () => {
				const id = uuid();

				await harness.unitOfWork.run(async ({ pages }) => {
					await pages.save(page(id, "Temporary"));
				});

				await harness.unitOfWork.run(async ({ pages }) => {
					await pages.delete(toFolderId(id));
				});

				expect(await harness.scope.pages.listAll()).toEqual([]);
			});
			test("keeps a page's summary and icon", async () => {
				const id = uuid();

				await harness.unitOfWork.run(({ pages }) =>
					pages.save(
						createFolder({
							id: toFolderId(id),
							name: "Chapter 2",
							summary: "# Data models\n\nRelational vs document.",
							icon: "📘",
							createdAt: at,
						}),
					),
				);

				const stored = await harness.scope.pages.findById(toFolderId(id));

				expect(stored?.summary).toBe(
					"# Data models\n\nRelational vs document.",
				);
				expect(stored?.icon).toBe("📘");
			});

			test("shows a quiz that is filed under another page", async () => {
				const notes = uuid();
				const books = uuid();

				await harness.unitOfWork.run(async ({ pages }) => {
					await pages.save(page(notes, "Chapter 1"));
					await pages.save(page(books, "Books"));
				});

				const quizId = await harness.seedQuiz(books, "published");

				await harness.unitOfWork.run(({ pages }) =>
					pages.attachQuiz(toFolderId(notes), toQuizSetId(quizId)),
				);

				expect(
					(
						await harness.scope.pages.listAttachedQuizIds(toFolderId(notes))
					).map(String),
				).toEqual([quizId]);
				expect(
					await harness.scope.pages.countQuizzesIn(toFolderId(notes)),
				).toBe(0);
			});

			test("attaching twice leaves one attachment, and detaching removes it", async () => {
				const notes = uuid();

				await harness.unitOfWork.run(({ pages }) =>
					pages.save(page(notes, "Chapter 1")),
				);

				const quizId = await harness.seedQuiz(notes, "published");

				await harness.unitOfWork.run(async ({ pages }) => {
					await pages.attachQuiz(toFolderId(notes), toQuizSetId(quizId));
					await pages.attachQuiz(toFolderId(notes), toQuizSetId(quizId));
				});

				expect(
					await harness.scope.pages.listAttachedQuizIds(toFolderId(notes)),
				).toHaveLength(1);

				await harness.unitOfWork.run(({ pages }) =>
					pages.detachQuiz(toFolderId(notes), toQuizSetId(quizId)),
				);

				expect(
					await harness.scope.pages.listAttachedQuizIds(toFolderId(notes)),
				).toEqual([]);
			});

			test("rewrites the summary and can clear it", async () => {
				const id = uuid();
				const page = createFolder({
					id: toFolderId(id),
					name: "Chapter 2",
					summary: "first draft",
					createdAt: at,
				});

				await harness.unitOfWork.run(({ pages }) => pages.save(page));
				await harness.unitOfWork.run(({ pages }) =>
					pages.save(writeSummary(page, "second draft", later)),
				);

				expect(
					(await harness.scope.pages.findById(toFolderId(id)))?.summary,
				).toBe("second draft");

				await harness.unitOfWork.run(({ pages }) =>
					pages.save(writeSummary(page, undefined, later)),
				);

				expect(
					(await harness.scope.pages.findById(toFolderId(id)))?.summary,
				).toBeUndefined();
			});
		},
	);
}
