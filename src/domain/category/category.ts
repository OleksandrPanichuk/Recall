import { type BrandedId, brandedId } from "../branded-id";
import {
	CategoryCycleError,
	CategoryDepthError,
	CategoryValidationError,
	DuplicateCategoryNameError,
} from "./category.errors";

export type CategoryId = BrandedId<"CategoryId">;

export const toCategoryId = (value: string): CategoryId =>
	brandedId<"CategoryId">(value, "CategoryId");

/**
 * The owner's deepest example is five — English / Vocabulary / By levels / A1 /
 * <sets>. Six leaves headroom while keeping a breadcrumb readable and the browse
 * screens finite.
 */
export const MAX_CATEGORY_DEPTH = 6;
export const MAX_CATEGORY_NAME = 60;

export interface Category {
	readonly id: CategoryId;
	readonly name: string;
	readonly parentId?: CategoryId;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

interface CategoryDraft {
	readonly id: CategoryId;
	readonly name: string;
	readonly parentId?: CategoryId;
	readonly createdAt: Date;
}

interface CategorySnapshot {
	readonly id: CategoryId;
	readonly name: string;
	readonly parentId?: CategoryId;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

const isValidDate = (value: Date): boolean => !Number.isNaN(value.getTime());

const copiedDate = (value: Date): Date => new Date(value.getTime());

const frozenCategory = (fields: Category): Category =>
	Object.freeze({
		...fields,
		createdAt: copiedDate(fields.createdAt),
		updatedAt: copiedDate(fields.updatedAt),
	});

const collectNameIssues = (name: string): readonly string[] => {
	if (name.length === 0) {
		return ["name must not be empty"];
	}

	return name.length > MAX_CATEGORY_NAME
		? [`name must not exceed ${MAX_CATEGORY_NAME} characters`]
		: [];
};

const assertNotOwnParent = (
	id: CategoryId,
	parentId: CategoryId | undefined,
): void => {
	if (parentId !== undefined && parentId === id) {
		throw new CategoryCycleError();
	}
};

const assertTransitionDate = (category: Category, at: Date): void => {
	if (!isValidDate(at)) {
		throw new CategoryValidationError(["at must be a valid date"]);
	}

	if (at.getTime() < category.updatedAt.getTime()) {
		throw new CategoryValidationError(["at must not precede updatedAt"]);
	}
};

export function createCategory(draft: CategoryDraft): Category {
	const name = draft.name.trim();
	const issues = [...collectNameIssues(name)];

	if (!isValidDate(draft.createdAt)) {
		issues.push("createdAt must be a valid date");
	}

	if (issues.length > 0) {
		throw new CategoryValidationError(issues);
	}

	assertNotOwnParent(draft.id, draft.parentId);

	return frozenCategory({
		id: draft.id,
		name,
		parentId: draft.parentId,
		createdAt: draft.createdAt,
		updatedAt: draft.createdAt,
	});
}

export function renameCategory(
	category: Category,
	name: string,
	at: Date,
): Category {
	assertTransitionDate(category, at);

	const trimmed = name.trim();
	const issues = collectNameIssues(trimmed);

	if (issues.length > 0) {
		throw new CategoryValidationError(issues);
	}

	return frozenCategory({ ...category, name: trimmed, updatedAt: at });
}

export function reparentCategory(
	category: Category,
	parentId: CategoryId | undefined,
	at: Date,
): Category {
	assertTransitionDate(category, at);
	assertNotOwnParent(category.id, parentId);

	return frozenCategory({ ...category, parentId, updatedAt: at });
}

/**
 * Judges a placement against facts only the tree knows.
 *
 * The domain never reads a repository, so the caller supplies the chain and the
 * siblings and this function decides. `ancestors` is root-first and excludes the
 * category itself; `siblings` is whatever `listChildren(parentId)` returned,
 * which on a rename or a same-parent move contains the category itself — hence
 * full categories rather than names, so its own row can be skipped.
 */
export function assertPlacement(
	category: Category,
	ancestors: readonly Category[],
	siblings: readonly Category[],
): void {
	if (ancestors.some((ancestor) => ancestor.id === category.id)) {
		throw new CategoryCycleError();
	}

	const depth = ancestors.length + 1;

	if (depth > MAX_CATEGORY_DEPTH) {
		throw new CategoryDepthError(depth, MAX_CATEGORY_DEPTH);
	}

	const taken = siblings.some(
		(sibling) =>
			sibling.id !== category.id &&
			sibling.name.toLocaleLowerCase() === category.name.toLocaleLowerCase(),
	);

	if (taken) {
		throw new DuplicateCategoryNameError(category.name);
	}
}

/**
 * Rebuilds a stored category. Field-level invariants are re-checked here for the
 * same reason `restoreQuizAttempt` re-checks its own: a hand-edited row must fail
 * loudly at the boundary rather than surface as an impossible aggregate later.
 */
export function restoreCategory(snapshot: CategorySnapshot): Category {
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
		throw new CategoryValidationError(issues);
	}

	assertNotOwnParent(snapshot.id, snapshot.parentId);

	return frozenCategory({
		id: snapshot.id,
		name,
		parentId: snapshot.parentId,
		createdAt: snapshot.createdAt,
		updatedAt: snapshot.updatedAt,
	});
}
