import { describe, expect, test } from "bun:test";
import {
	assertPlacement,
	type Category,
	createCategory,
	MAX_CATEGORY_DEPTH,
	MAX_CATEGORY_NAME,
	renameCategory,
	reparentCategory,
	restoreCategory,
	toCategoryId,
} from "./category";
import {
	CategoryCycleError,
	CategoryDepthError,
	CategoryValidationError,
	DuplicateCategoryNameError,
} from "./category.errors";

const createdAt = new Date("2026-08-01T10:00:00.000Z");
const laterAt = new Date("2026-08-02T10:00:00.000Z");
const earlierAt = new Date("2026-07-01T10:00:00.000Z");
const invalidDate = new Date("not a date");

type CategoryDraft = Parameters<typeof createCategory>[0];

const aCategory = (overrides: Partial<CategoryDraft> = {}): Category =>
	createCategory({
		id: toCategoryId("cat-1"),
		name: "English",
		createdAt,
		...overrides,
	});

const chainOf = (length: number): Category[] =>
	Array.from({ length }, (_value, index) =>
		aCategory({ id: toCategoryId(`ancestor-${index}`), name: `L${index}` }),
	);

const issuesOf = (draft: CategoryDraft): readonly string[] => {
	try {
		createCategory(draft);
	} catch (caught) {
		expect(caught).toBeInstanceOf(CategoryValidationError);

		return (caught as CategoryValidationError).issues;
	}

	throw new Error("expected createCategory to throw");
};

describe("createCategory", () => {
	test("starts at the root with a trimmed name and equal timestamps", () => {
		const category = aCategory({ name: "  English  " });

		expect(category.name).toBe("English");
		expect(category.parentId).toBeUndefined();
		expect(category.createdAt).toEqual(createdAt);
		expect(category.updatedAt).toEqual(createdAt);
	});

	test("keeps the parent it was given", () => {
		expect(String(aCategory({ parentId: toCategoryId("root") }).parentId)).toBe(
			"root",
		);
	});

	test("returns a frozen category that copies its dates", () => {
		const mutable = new Date(createdAt.getTime());
		const category = aCategory({ createdAt: mutable });

		mutable.setFullYear(1999);

		expect(Object.isFrozen(category)).toBe(true);
		expect(category.createdAt).toEqual(createdAt);
	});

	test.each(["", "   "])("rejects the name %p", (name) => {
		expect(issuesOf({ id: toCategoryId("cat-1"), name, createdAt })).toContain(
			"name must not be empty",
		);
	});

	test("rejects a name over the limit", () => {
		expect(
			issuesOf({
				id: toCategoryId("cat-1"),
				name: "x".repeat(MAX_CATEGORY_NAME + 1),
				createdAt,
			}),
		).toContain(`name must not exceed ${MAX_CATEGORY_NAME} characters`);
	});

	test("rejects an invalid createdAt", () => {
		expect(
			issuesOf({
				id: toCategoryId("cat-1"),
				name: "English",
				createdAt: invalidDate,
			}),
		).toContain("createdAt must be a valid date");
	});

	test("refuses to be its own parent", () => {
		expect(() =>
			aCategory({ id: toCategoryId("cat-1"), parentId: toCategoryId("cat-1") }),
		).toThrow(CategoryCycleError);
	});
});

describe("renameCategory", () => {
	test("renames and advances updatedAt", () => {
		const renamed = renameCategory(aCategory(), "  Англійська  ", laterAt);

		expect(renamed.name).toBe("Англійська");
		expect(renamed.updatedAt).toEqual(laterAt);
		expect(renamed.createdAt).toEqual(createdAt);
	});

	test("keeps the parent", () => {
		const child = aCategory({ parentId: toCategoryId("root") });

		expect(String(renameCategory(child, "Other", laterAt).parentId)).toBe(
			"root",
		);
	});

	test("rejects an empty name", () => {
		expect(() => renameCategory(aCategory(), "  ", laterAt)).toThrow(
			CategoryValidationError,
		);
	});

	test("refuses a timestamp that moves backwards", () => {
		expect(() => renameCategory(aCategory(), "Other", earlierAt)).toThrow(
			CategoryValidationError,
		);
	});
});

describe("reparentCategory", () => {
	test("moves under a new parent", () => {
		expect(
			String(
				reparentCategory(aCategory(), toCategoryId("root"), laterAt).parentId,
			),
		).toBe("root");
	});

	test("moves back to the root", () => {
		const child = aCategory({ parentId: toCategoryId("root") });

		expect(
			reparentCategory(child, undefined, laterAt).parentId,
		).toBeUndefined();
	});

	test("refuses to become its own parent", () => {
		const category = aCategory();

		expect(() => reparentCategory(category, category.id, laterAt)).toThrow(
			CategoryCycleError,
		);
	});

	test("refuses a timestamp that moves backwards", () => {
		expect(() =>
			reparentCategory(aCategory(), toCategoryId("root"), earlierAt),
		).toThrow(CategoryValidationError);
	});
});

describe("assertPlacement", () => {
	test("accepts a placement inside the depth limit", () => {
		expect(() =>
			assertPlacement(aCategory(), chainOf(MAX_CATEGORY_DEPTH - 1), []),
		).not.toThrow();
	});

	test("rejects a placement past the depth limit", () => {
		expect(() =>
			assertPlacement(aCategory(), chainOf(MAX_CATEGORY_DEPTH), []),
		).toThrow(CategoryDepthError);
	});

	test("rejects an ancestor chain containing the category itself", () => {
		const category = aCategory();

		expect(() => assertPlacement(category, [category], [])).toThrow(
			CategoryCycleError,
		);
	});

	test("rejects a name a sibling already uses, ignoring case", () => {
		const sibling = aCategory({ id: toCategoryId("other"), name: "food" });

		expect(() =>
			assertPlacement(aCategory({ name: "Food" }), [], [sibling]),
		).toThrow(DuplicateCategoryNameError);
	});

	// listChildren returns the category itself on a rename or a same-parent move,
	// and a name cannot collide with itself.
	test("ignores the category's own row among the siblings", () => {
		const category = aCategory({ name: "Food" });

		expect(() => assertPlacement(category, [], [category])).not.toThrow();
	});

	test("allows a case-only rename of the category itself", () => {
		const category = aCategory({ name: "food" });

		expect(() =>
			assertPlacement(
				renameCategory(category, "Food", laterAt),
				[],
				[category],
			),
		).not.toThrow();
	});

	test("allows the same name under a different parent", () => {
		expect(() =>
			assertPlacement(aCategory({ name: "A1" }), chainOf(2), []),
		).not.toThrow();
	});

	test("reports the depth it refused", () => {
		try {
			assertPlacement(aCategory(), chainOf(MAX_CATEGORY_DEPTH), []);
		} catch (caught) {
			expect((caught as Error).message).toContain(String(MAX_CATEGORY_DEPTH));

			return;
		}

		throw new Error("expected assertPlacement to throw");
	});
});

describe("restoreCategory", () => {
	test.each([
		["a root category", () => aCategory()],
		["a child category", () => aCategory({ parentId: toCategoryId("root") })],
		[
			"a renamed category",
			() => renameCategory(aCategory(), "Renamed", laterAt),
		],
	])("restores %s the transitions produce", (_name, build) => {
		const expected = build();

		expect(
			restoreCategory({
				id: expected.id,
				name: expected.name,
				parentId: expected.parentId,
				createdAt: expected.createdAt,
				updatedAt: expected.updatedAt,
			}),
		).toEqual(expected);
	});

	test("rejects an updatedAt before createdAt", () => {
		expect(() =>
			restoreCategory({
				id: toCategoryId("cat-1"),
				name: "English",
				createdAt,
				updatedAt: earlierAt,
			}),
		).toThrow(CategoryValidationError);
	});

	test("rejects a category that is its own parent", () => {
		expect(() =>
			restoreCategory({
				id: toCategoryId("cat-1"),
				name: "English",
				parentId: toCategoryId("cat-1"),
				createdAt,
				updatedAt: createdAt,
			}),
		).toThrow(CategoryCycleError);
	});

	test("rejects an empty name", () => {
		expect(() =>
			restoreCategory({
				id: toCategoryId("cat-1"),
				name: "   ",
				createdAt,
				updatedAt: createdAt,
			}),
		).toThrow(CategoryValidationError);
	});

	test("copies dates and freezes the restored category", () => {
		const mutable = new Date(createdAt.getTime());
		const restored = restoreCategory({
			id: toCategoryId("cat-1"),
			name: "English",
			createdAt: mutable,
			updatedAt: laterAt,
		});

		mutable.setFullYear(1999);

		expect(restored.createdAt).toEqual(createdAt);
		expect(Object.isFrozen(restored)).toBe(true);
	});
});
