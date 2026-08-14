import { type Folder, restoreFolder, toFolderId } from "@/domain/folder/folder";
import type { folders } from "../schema";

export type FolderRow = typeof folders.$inferSelect;
export type FolderInsert = typeof folders.$inferInsert;

export class CorruptedFolderRowError extends Error {
	readonly issues: readonly string[];

	constructor(id: string, issues: readonly string[]) {
		super(
			`Folder ${id} cannot be restored from storage:\n${issues
				.map((issue) => `- ${issue}`)
				.join("\n")}`,
		);
		this.name = "CorruptedFolderRowError";
		this.issues = issues;
	}
}

const requiredDate = (value: string, column: string, id: string): Date => {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		throw new CorruptedFolderRowError(id, [
			`${column} must be a valid ISO timestamp`,
		]);
	}

	return date;
};

export function toFolder(row: FolderRow): Folder {
	return restoreFolder({
		id: toFolderId(row.id),
		name: row.name,
		parentId: row.parentId === null ? undefined : toFolderId(row.parentId),
		createdAt: requiredDate(row.createdAt, "created_at", row.id),
		updatedAt: requiredDate(row.updatedAt, "updated_at", row.id),
	});
}

export function toFolderRow(folder: Folder): FolderInsert {
	return {
		id: folder.id,
		name: folder.name,
		parentId: folder.parentId ?? null,
		createdAt: folder.createdAt.toISOString(),
		updatedAt: folder.updatedAt.toISOString(),
	};
}
