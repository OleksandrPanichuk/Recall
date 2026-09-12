import { HttpStatus } from "@nestjs/common";
import { ModuleError } from "@/core/errors";
import type { PageId } from "./page.entity";

export class FolderValidationError extends ModuleError {
	readonly status = HttpStatus.BAD_REQUEST;
	readonly code = "PAGE_INVALID";
	readonly issues: readonly string[];

	constructor(issues: readonly string[]) {
		super(`Invalid folder:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
		this.issues = issues;
	}
}

export class FolderCycleError extends ModuleError {
	readonly status = HttpStatus.CONFLICT;
	readonly code = "PAGE_CYCLE";

	constructor() {
		super("A folder cannot be placed inside itself or its own descendant");
	}
}

export class FolderDepthError extends ModuleError {
	readonly status = HttpStatus.CONFLICT;
	readonly code = "PAGE_TOO_DEEP";
	readonly depth: number;
	readonly limit: number;

	constructor(depth: number, limit: number) {
		super(`A folder may be nested ${limit} deep; this would be ${depth}`);
		this.depth = depth;
		this.limit = limit;
	}
}

export class DuplicateFolderNameError extends ModuleError {
	readonly status = HttpStatus.CONFLICT;
	readonly code = "PAGE_NAME_TAKEN";
	readonly folderName: string;

	constructor(folderName: string) {
		super(`A folder named "${folderName}" already exists here`);
		this.folderName = folderName;
	}
}

export class FolderNotFoundError extends ModuleError {
	readonly status = HttpStatus.NOT_FOUND;
	readonly code = "PAGE_NOT_FOUND";
	readonly folderId: PageId;

	constructor(folderId: PageId) {
		super(`Folder ${folderId} does not exist`);
		this.folderId = folderId;
	}

	override details(): Readonly<Record<string, string>> {
		return { folderId: String(this.folderId) };
	}
}

export class FolderNotEmptyError extends ModuleError {
	readonly status = HttpStatus.CONFLICT;
	readonly code = "PAGE_NOT_EMPTY";
	readonly folderId: PageId;
	readonly children: number;
	readonly sets: number;

	constructor(folderId: PageId, children: number, sets: number) {
		const held = [
			children === 0 ? undefined : `${children} folder(s)`,
			sets === 0 ? undefined : `${sets} set(s)`,
		].filter((part) => part !== undefined);

		super(`Folder ${folderId} still holds ${held.join(" and ")}`);
		this.folderId = folderId;
		this.children = children;
		this.sets = sets;
	}

	override details(): Readonly<Record<string, string>> {
		return { folderId: String(this.folderId) };
	}
}

export class FolderPathNotFoundError extends ModuleError {
	readonly status = HttpStatus.NOT_FOUND;
	readonly code = "PAGE_PATH_NOT_FOUND";
	readonly path: readonly string[];

	constructor(path: readonly string[]) {
		super(`No folder at "${path.join(" / ")}"`);
		this.path = path;
	}
}
