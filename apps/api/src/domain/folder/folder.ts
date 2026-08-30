import { copiedDate, isValidDate } from "@/shared/utils/date";
import { type BrandedId, brandedId } from "../branded-id";
import {
	DuplicateFolderNameError,
	FolderCycleError,
	FolderDepthError,
	FolderValidationError,
} from "./folder.errors";
import { POSITION_STEP, roundPosition } from "./ordering";

export type FolderId = BrandedId<"FolderId">;

export const toFolderId = (value: string): FolderId =>
	brandedId<"FolderId">(value, "FolderId");

export const MAX_FOLDER_DEPTH = 6;
export const MAX_FOLDER_NAME = 60;
export const MAX_SUMMARY_LENGTH = 200_000;

export interface Folder {
	readonly id: FolderId;
	readonly name: string;
	readonly parentId?: FolderId;
	readonly summary?: string;
	readonly icon?: string;
	readonly position: number;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

interface FolderDraft {
	readonly id: FolderId;
	readonly name: string;
	readonly parentId?: FolderId;
	readonly summary?: string;
	readonly icon?: string;
	readonly position?: number;
	readonly createdAt: Date;
}

interface FolderSnapshot {
	readonly id: FolderId;
	readonly name: string;
	readonly parentId?: FolderId;
	readonly summary?: string;
	readonly icon?: string;
	readonly position?: number;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

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
		summary: summaryOf(draft.summary),
		icon: trimmedOrUndefined(draft.icon),
		position: draft.position ?? POSITION_STEP,
		createdAt: draft.createdAt,
		updatedAt: draft.createdAt,
	});
}

const trimmedOrUndefined = (value: string | undefined): string | undefined => {
	const trimmed = value?.trim() ?? "";

	return trimmed.length === 0 ? undefined : trimmed;
};

const summaryOf = (value: string | undefined): string | undefined => {
	const summary = trimmedOrUndefined(value);

	if (summary !== undefined && summary.length > MAX_SUMMARY_LENGTH) {
		throw new FolderValidationError([
			`summary must not exceed ${MAX_SUMMARY_LENGTH} characters`,
		]);
	}

	return summary;
};

export function writeSummary(
	folder: Folder,
	summary: string | undefined,
	at: Date,
): Folder {
	assertTransitionDate(folder, at);

	return frozenFolder({
		...folder,
		summary: summaryOf(summary),
		updatedAt: at,
	});
}

export const MAX_ICON_LENGTH = 8;

export function setIcon(
	folder: Folder,
	icon: string | undefined,
	at: Date,
): Folder {
	assertTransitionDate(folder, at);

	const trimmed = trimmedOrUndefined(icon);

	if (trimmed !== undefined && [...trimmed].length > MAX_ICON_LENGTH) {
		throw new FolderValidationError([
			`icon must not exceed ${MAX_ICON_LENGTH} characters`,
		]);
	}

	return frozenFolder({ ...folder, icon: trimmed, updatedAt: at });
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

export function reorderFolder(
	folder: Folder,
	position: number,
	at: Date,
): Folder {
	assertTransitionDate(folder, at);

	if (!Number.isFinite(position)) {
		throw new FolderValidationError(["position must be a finite number"]);
	}

	return frozenFolder({
		...folder,
		position: roundPosition(position),
		updatedAt: at,
	});
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
		summary: summaryOf(snapshot.summary),
		icon: trimmedOrUndefined(snapshot.icon),
		position: snapshot.position ?? POSITION_STEP,
		createdAt: snapshot.createdAt,
		updatedAt: snapshot.updatedAt,
	});
}
