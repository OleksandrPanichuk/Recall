import { type Folder, restoreFolder, toFolderId } from "@/domain/folder/folder";
import type { folders } from "../schema";
import { CorruptedFolderRowError } from "./folder.mapper.errors";
import { createRowValueParsers } from "./utils/row-values";

export { CorruptedFolderRowError } from "./folder.mapper.errors";

export type FolderRow = typeof folders.$inferSelect;
export type FolderInsert = typeof folders.$inferInsert;

const { requiredDate } = createRowValueParsers(
	(id, issues) => new CorruptedFolderRowError(id, issues),
);

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
