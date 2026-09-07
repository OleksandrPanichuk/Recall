import { type BrandedId, brandedId } from "@/core/branded-id";
import { copiedDate, isValidDate } from "@/shared/utils/date";
import { PagePosition } from "./page.ordering";
import {
	DuplicateFolderNameError,
	FolderCycleError,
	FolderDepthError,
	FolderValidationError,
} from "./pages.errors";

export type PageId = BrandedId<"FolderId">;

export const toPageId = (value: string): PageId =>
	brandedId<"FolderId">(value, "FolderId");

export interface PageEntity {
	readonly id: PageId;
	readonly name: string;
	readonly parentId?: PageId;
	readonly summary?: string;
	readonly icon?: string;
	readonly position: number;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

export interface PageDraft {
	readonly id: PageId;
	readonly name: string;
	readonly parentId?: PageId;
	readonly summary?: string;
	readonly icon?: string;
	readonly position?: number;
	readonly createdAt: Date;
}

export interface PageSnapshot extends PageDraft {
	readonly updatedAt: Date;
}

const trimmedOrUndefined = (value: string | undefined): string | undefined => {
	const trimmed = value?.trim() ?? "";

	return trimmed.length === 0 ? undefined : trimmed;
};

export class PageEntity {
	private constructor() {}

	static readonly MAX_DEPTH = 6;
	static readonly MAX_NAME = 60;
	static readonly MAX_SUMMARY = 200_000;
	static readonly MAX_ICON = 8;

	static create(draft: PageDraft): PageEntity {
		const name = draft.name.trim();
		const issues = [...PageEntity.nameIssues(name)];

		if (!isValidDate(draft.createdAt)) {
			issues.push("createdAt must be a valid date");
		}

		if (issues.length > 0) {
			throw new FolderValidationError(issues);
		}

		PageEntity.assertNotOwnParent(draft.id, draft.parentId);

		return PageEntity.frozen({
			id: draft.id,
			name,
			parentId: draft.parentId,
			summary: PageEntity.summaryOf(draft.summary),
			icon: trimmedOrUndefined(draft.icon),
			position: draft.position ?? PagePosition.STEP,
			createdAt: draft.createdAt,
			updatedAt: draft.createdAt,
		});
	}

	static restore(snapshot: PageSnapshot): PageEntity {
		const name = snapshot.name.trim();
		const issues = [...PageEntity.nameIssues(name)];

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

		PageEntity.assertNotOwnParent(snapshot.id, snapshot.parentId);

		return PageEntity.frozen({
			id: snapshot.id,
			name,
			parentId: snapshot.parentId,
			summary: PageEntity.summaryOf(snapshot.summary),
			icon: trimmedOrUndefined(snapshot.icon),
			position: snapshot.position ?? PagePosition.STEP,
			createdAt: snapshot.createdAt,
			updatedAt: snapshot.updatedAt,
		});
	}

	static withSummary(
		page: PageEntity,
		summary: string | undefined,
		at: Date,
	): PageEntity {
		PageEntity.assertTransitionDate(page, at);

		return PageEntity.frozen({
			...page,
			summary: PageEntity.summaryOf(summary),
			updatedAt: at,
		});
	}

	static withIcon(
		page: PageEntity,
		icon: string | undefined,
		at: Date,
	): PageEntity {
		PageEntity.assertTransitionDate(page, at);

		const trimmed = trimmedOrUndefined(icon);

		if (trimmed !== undefined && [...trimmed].length > PageEntity.MAX_ICON) {
			throw new FolderValidationError([
				`icon must not exceed ${PageEntity.MAX_ICON} characters`,
			]);
		}

		return PageEntity.frozen({ ...page, icon: trimmed, updatedAt: at });
	}

	static renamed(page: PageEntity, name: string, at: Date): PageEntity {
		PageEntity.assertTransitionDate(page, at);

		const trimmed = name.trim();
		const issues = PageEntity.nameIssues(trimmed);

		if (issues.length > 0) {
			throw new FolderValidationError(issues);
		}

		return PageEntity.frozen({ ...page, name: trimmed, updatedAt: at });
	}

	static reparented(
		page: PageEntity,
		parentId: PageId | undefined,
		at: Date,
	): PageEntity {
		PageEntity.assertTransitionDate(page, at);
		PageEntity.assertNotOwnParent(page.id, parentId);

		return PageEntity.frozen({ ...page, parentId, updatedAt: at });
	}

	static reordered(page: PageEntity, position: number, at: Date): PageEntity {
		PageEntity.assertTransitionDate(page, at);

		if (!Number.isFinite(position)) {
			throw new FolderValidationError(["position must be a finite number"]);
		}

		return PageEntity.frozen({
			...page,
			position: PagePosition.round(position),
			updatedAt: at,
		});
	}

	static assertPlacement(
		page: PageEntity,
		ancestors: readonly PageEntity[],
		siblings: readonly PageEntity[],
	): void {
		if (ancestors.some((ancestor) => ancestor.id === page.id)) {
			throw new FolderCycleError();
		}

		const depth = ancestors.length + 1;

		if (depth > PageEntity.MAX_DEPTH) {
			throw new FolderDepthError(depth, PageEntity.MAX_DEPTH);
		}

		const taken = siblings.some(
			(sibling) =>
				sibling.id !== page.id &&
				sibling.name.toLocaleLowerCase() === page.name.toLocaleLowerCase(),
		);

		if (taken) {
			throw new DuplicateFolderNameError(page.name);
		}
	}

	private static frozen(fields: PageEntity): PageEntity {
		return Object.freeze({
			...fields,
			createdAt: copiedDate(fields.createdAt),
			updatedAt: copiedDate(fields.updatedAt),
		});
	}

	private static assertTransitionDate(page: PageEntity, at: Date): void {
		if (!isValidDate(at)) {
			throw new FolderValidationError(["at must be a valid date"]);
		}

		if (at.getTime() < page.updatedAt.getTime()) {
			throw new FolderValidationError(["at must not precede updatedAt"]);
		}
	}

	private static nameIssues(name: string): readonly string[] {
		if (name.length === 0) {
			return ["name must not be empty"];
		}

		return name.length > PageEntity.MAX_NAME
			? [`name must not exceed ${PageEntity.MAX_NAME} characters`]
			: [];
	}

	private static assertNotOwnParent(
		id: PageId,
		parentId: PageId | undefined,
	): void {
		if (parentId !== undefined && parentId === id) {
			throw new FolderCycleError();
		}
	}

	private static summaryOf(value: string | undefined): string | undefined {
		const summary = trimmedOrUndefined(value);

		if (summary !== undefined && summary.length > PageEntity.MAX_SUMMARY) {
			throw new FolderValidationError([
				`summary must not exceed ${PageEntity.MAX_SUMMARY} characters`,
			]);
		}

		return summary;
	}
}
