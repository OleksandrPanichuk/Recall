import { type BrandedId, brandedId } from "../branded-id";
import {
	DuplicateFolderNameError,
	FolderCycleError,
	FolderDepthError,
	FolderValidationError,
} from "./folder.errors";

export type FolderId = BrandedId<"FolderId">;

export const toFolderId = (value: string): FolderId =>
	brandedId<"FolderId">(value, "FolderId");

export const MAX_FOLDER_DEPTH = 6;
export const MAX_FOLDER_NAME = 60;

export interface Folder {
	readonly id: FolderId;
	readonly name: string;
	readonly parentId?: FolderId;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

interface FolderDraft {
	readonly id: FolderId;
	readonly name: string;
	readonly parentId?: FolderId;
	readonly createdAt: Date;
}

interface FolderSnapshot {
	readonly id: FolderId;
	readonly name: string;
	readonly parentId?: FolderId;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

const copiedDate = (value: Date): Date => new Date(value.getTime());

const frozenFolder = (fields: Folder): Folder =>
	Object.freeze({
		...fields,
		createdAt: copiedDate(fields.createdAt),
		updatedAt: copiedDate(fields.updatedAt),
	});

const collectNameIssues = (name: string): readonly string[] => {
	if (name.length === 0) {
		return ["name must not be empty"];
	}

	return name.length > MAX_FOLDER_NAME
		? [`name must not exceed ${MAX_FOLDER_NAME} characters`]
		: [];
};

const assertNotOwnParent = (
	id: FolderId,
	parentId: FolderId | undefined,
): void => {
	if (parentId !== undefined && parentId === id) {
		throw new FolderCycleError();
	}
};

const assertTransitionDate = (folder: Folder, at: Date): void => {
	if (!isValidDate(at)) {
		throw new FolderValidationError(["at must be a valid date"]);
	}

	if (at.getTime() < folder.updatedAt.getTime()) {
		throw new FolderValidationError(["at must not precede updatedAt"]);
	}
};

export function createFolder(draft: FolderDraft): Folder {
	const name = draft.name.trim();
	const issues = [...collectNameIssues(name)];

	if (!isValidDate(draft.createdAt)) {
		issues.push("createdAt must be a valid date");
	}

	if (issues.length > 0) {
		throw new FolderValidationError(issues);
	}

	assertNotOwnParent(draft.id, draft.parentId);

	return frozenFolder({
		id: draft.id,
		name,
		parentId: draft.parentId,
		createdAt: draft.createdAt,
		updatedAt: draft.createdAt,
	});
}

export function renameFolder(folder: Folder, name: string, at: Date): Folder {
	assertTransitionDate(folder, at);

	const trimmed = name.trim();
	const issues = collectNameIssues(trimmed);

	if (issues.length > 0) {
		throw new FolderValidationError(issues);
	}

	return frozenFolder({ ...folder, name: trimmed, updatedAt: at });
}

export function reparentFolder(
	folder: Folder,
	parentId: FolderId | undefined,
	at: Date,
): Folder {
	assertTransitionDate(folder, at);
	assertNotOwnParent(folder.id, parentId);

	return frozenFolder({ ...folder, parentId, updatedAt: at });
}

export function assertPlacement(
	folder: Folder,
	ancestors: readonly Folder[],
	siblings: readonly Folder[],
): void {
	if (ancestors.some((ancestor) => ancestor.id === folder.id)) {
		throw new FolderCycleError();
	}

	const depth = ancestors.length + 1;

	if (depth > MAX_FOLDER_DEPTH) {
		throw new FolderDepthError(depth, MAX_FOLDER_DEPTH);
	}

	const taken = siblings.some(
		(sibling) =>
			sibling.id !== folder.id &&
			sibling.name.toLocaleLowerCase() === folder.name.toLocaleLowerCase(),
	);

	if (taken) {
		throw new DuplicateFolderNameError(folder.name);
	}
}

export function restoreFolder(snapshot: FolderSnapshot): Folder {
	const name = snapshot.name.trim();
	const issues = [...collectNameIssues(name)];

	if (!isValidDate(snapshot.createdAt)) {
		issues.push("createdAt must be a valid date");
	}

	if (!isValidDate(snapshot.updatedAt)) {
		issues.push("updatedAt must be a valid date");
	}

	if (
		isValidDate(snapshot.createdAt) &&
		isValidDate(snapshot.updatedAt) &&
		snapshot.updatedAt.getTime() < snapshot.createdAt.getTime()
	) {
		issues.push("updatedAt must not precede createdAt");
	}

	if (issues.length > 0) {
		throw new FolderValidationError(issues);
	}

	assertNotOwnParent(snapshot.id, snapshot.parentId);

	return frozenFolder({
		id: snapshot.id,
		name,
		parentId: snapshot.parentId,
		createdAt: snapshot.createdAt,
		updatedAt: snapshot.updatedAt,
	});
}
