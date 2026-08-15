import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import type { FolderRepository } from "@/application/ports/repositories/folder.repository";
import type { Transaction } from "@/application/ports/transaction";
import {
	type Folder,
	type FolderId,
	MAX_FOLDER_DEPTH,
} from "@/domain/folder/folder";
import type { QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import type { QuizDatabase } from "../database";
import { folders, quizSets } from "../schema";
import { toFolder, toFolderRow } from "./folder.mapper";

export function createSqliteFolderRepository(
	database: QuizDatabase,
	transaction: Transaction,
): FolderRepository {
	const byId = (id: string): Folder | undefined => {
		const row = database.select().from(folders).where(eq(folders.id, id)).get();

		return row ? toFolder(row) : undefined;
	};

	return {
		save(folder: Folder): void {
			const row = toFolderRow(folder);

			transaction.run(() => {
				database
					.insert(folders)
					.values(row)
					.onConflictDoUpdate({ target: folders.id, set: row })
					.run();
			});
		},

		findById(id: FolderId): Folder | undefined {
			return byId(id);
		},

		listChildren(parentId: FolderId | undefined): readonly Folder[] {
			return database
				.select()
				.from(folders)
				.where(
					parentId === undefined
						? isNull(folders.parentId)
						: eq(folders.parentId, parentId),
				)
				.orderBy(asc(folders.name), asc(folders.id))
				.all()
				.map(toFolder);
		},

		listAncestors(id: FolderId): readonly Folder[] {
			const chain: Folder[] = [];
			let current = byId(id)?.parentId;

			for (
				let step = 0;
				step < MAX_FOLDER_DEPTH && current !== undefined;
				step += 1
			) {
				const parent = byId(current);

				if (parent === undefined) {
					break;
				}

				chain.push(parent);
				current = parent.parentId;
			}

			return chain.reverse();
		},

		listAll(): readonly Folder[] {
			return database
				.select()
				.from(folders)
				.orderBy(asc(folders.name), asc(folders.id))
				.all()
				.map(toFolder);
		},

		countSetsIn(id: FolderId, statuses?: readonly QuizSetStatus[]): number {
			return (
				database
					.select({ total: count() })
					.from(quizSets)
					.where(
						statuses === undefined
							? eq(quizSets.folderId, id)
							: and(
									eq(quizSets.folderId, id),
									inArray(quizSets.status, [...statuses]),
								),
					)
					.get()?.total ?? 0
			);
		},

		countChildFolders(id: FolderId): number {
			return (
				database
					.select({ total: count() })
					.from(folders)
					.where(eq(folders.parentId, id))
					.get()?.total ?? 0
			);
		},

		delete(id: FolderId): void {
			transaction.run(() => {
				database.delete(folders).where(eq(folders.id, id)).run();
			});
		},
	};
}
