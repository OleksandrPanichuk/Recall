import { describe, expect, test } from "bun:test";
import {
	assertPlacement,
	createFolder,
	type Folder,
	MAX_FOLDER_DEPTH,
	MAX_FOLDER_NAME,
	renameFolder,
	reparentFolder,
	restoreFolder,
	toFolderId,
} from "./folder";
import {
	DuplicateFolderNameError,
	FolderCycleError,
	FolderDepthError,
	FolderValidationError,
} from "./folder.errors";

const createdAt = new Date("2026-08-01T10:00:00.000Z");
const laterAt = new Date("2026-08-02T10:00:00.000Z");
const earlierAt = new Date("2026-07-01T10:00:00.000Z");
const invalidDate = new Date("not a date");

type FolderDraft = Parameters<typeof createFolder>[0];

const aFolder = (overrides: Partial<FolderDraft> = {}): Folder =>
	createFolder({
		id: toFolderId("cat-1"),
		name: "English",
		createdAt,
		...overrides,
	});

const chainOf = (length: number): Folder[] =>
	Array.from({ length }, (_value, index) =>
		aFolder({ id: toFolderId(`ancestor-${index}`), name: `L${index}` }),
	);

const issuesOf = (draft: FolderDraft): readonly string[] => {
	try {
		createFolder(draft);
	} catch (caught) {
		expect(caught).toBeInstanceOf(FolderValidationError);

		return (caught as FolderValidationError).issues;
	}

	throw new Error("expected createFolder to throw");
};

describe("createFolder", () => {
	test("starts at the root with a trimmed name and equal timestamps", () => {
		const folder = aFolder({ name: "  English  " });

		expect(folder.name).toBe("English");
		expect(folder.parentId).toBeUndefined();
		expect(folder.createdAt).toEqual(createdAt);
		expect(folder.updatedAt).toEqual(createdAt);
	});

	test("keeps the parent it was given", () => {
		expect(String(aFolder({ parentId: toFolderId("root") }).parentId)).toBe(
			"root",
		);
	});

	test("returns a frozen folder that copies its dates", () => {
		const mutable = new Date(createdAt.getTime());
		const folder = aFolder({ createdAt: mutable });

		mutable.setFullYear(1999);

		expect(Object.isFrozen(folder)).toBe(true);
		expect(folder.createdAt).toEqual(createdAt);
	});

	test.each(["", "   "])("rejects the name %p", (name) => {
		expect(issuesOf({ id: toFolderId("cat-1"), name, createdAt })).toContain(
			"name must not be empty",
		);
	});

	test("accepts a name of exactly the limit", () => {
		expect(aFolder({ name: "x".repeat(MAX_FOLDER_NAME) }).name).toHaveLength(
			MAX_FOLDER_NAME,
		);
	});

	test("rejects a name over the limit", () => {
		expect(
			issuesOf({
				id: toFolderId("cat-1"),
				name: "x".repeat(MAX_FOLDER_NAME + 1),
				createdAt,
			}),
		).toContain(`name must not exceed ${MAX_FOLDER_NAME} characters`);
	});

	test("rejects an invalid createdAt", () => {
		expect(
			issuesOf({
				id: toFolderId("cat-1"),
				name: "English",
				createdAt: invalidDate,
			}),
		).toContain("createdAt must be a valid date");
	});

	test("refuses to be its own parent", () => {
		expect(() =>
			aFolder({ id: toFolderId("cat-1"), parentId: toFolderId("cat-1") }),
		).toThrow(FolderCycleError);
	});
});

describe("renameFolder", () => {
	test("renames and advances updatedAt", () => {
		const renamed = renameFolder(aFolder(), "  Англійська  ", laterAt);

		expect(renamed.name).toBe("Англійська");
		expect(renamed.updatedAt).toEqual(laterAt);
		expect(renamed.createdAt).toEqual(createdAt);
	});

	test("keeps the parent", () => {
		const child = aFolder({ parentId: toFolderId("root") });

		expect(String(renameFolder(child, "Other", laterAt).parentId)).toBe("root");
	});

	test("rejects an empty name", () => {
		expect(() => renameFolder(aFolder(), "  ", laterAt)).toThrow(
			FolderValidationError,
		);
	});

	test("refuses a timestamp that moves backwards", () => {
		expect(() => renameFolder(aFolder(), "Other", earlierAt)).toThrow(
			FolderValidationError,
		);
	});
});

describe("reparentFolder", () => {
	test("moves under a new parent and advances updatedAt", () => {
		const moved = reparentFolder(aFolder(), toFolderId("root"), laterAt);

		expect(String(moved.parentId)).toBe("root");
		expect(moved.updatedAt).toEqual(laterAt);
		expect(moved.createdAt).toEqual(createdAt);
	});

	test("moves back to the root", () => {
		const child = aFolder({ parentId: toFolderId("root") });

		expect(reparentFolder(child, undefined, laterAt).parentId).toBeUndefined();
	});

	test("refuses to become its own parent", () => {
		const folder = aFolder();

		expect(() => reparentFolder(folder, folder.id, laterAt)).toThrow(
			FolderCycleError,
		);
	});

	test("refuses a timestamp that moves backwards", () => {
		expect(() =>
			reparentFolder(aFolder(), toFolderId("root"), earlierAt),
		).toThrow(FolderValidationError);
	});
});

describe("assertPlacement", () => {
	test("accepts a placement inside the depth limit", () => {
		expect(() =>
			assertPlacement(aFolder(), chainOf(MAX_FOLDER_DEPTH - 1), []),
		).not.toThrow();
	});

	test("rejects a placement past the depth limit", () => {
		expect(() =>
			assertPlacement(aFolder(), chainOf(MAX_FOLDER_DEPTH), []),
		).toThrow(FolderDepthError);
	});

	test("rejects an ancestor chain containing the folder itself", () => {
		const folder = aFolder();

		expect(() => assertPlacement(folder, [folder], [])).toThrow(
			FolderCycleError,
		);
	});

	test("rejects a name a sibling already uses, ignoring case", () => {
		const sibling = aFolder({ id: toFolderId("other"), name: "food" });

		expect(() =>
			assertPlacement(aFolder({ name: "Food" }), [], [sibling]),
		).toThrow(DuplicateFolderNameError);
	});

	test("ignores the folder's own row among the siblings", () => {
		const folder = aFolder({ name: "Food" });

		expect(() => assertPlacement(folder, [], [folder])).not.toThrow();
	});

	test("allows a case-only rename of the folder itself", () => {
		const folder = aFolder({ name: "food" });

		expect(() =>
			assertPlacement(renameFolder(folder, "Food", laterAt), [], [folder]),
		).not.toThrow();
	});

	test("allows the same name under a different parent", () => {
		expect(() =>
			assertPlacement(aFolder({ name: "A1" }), chainOf(2), []),
		).not.toThrow();
	});

	test("reports the depth it refused", () => {
		try {
			assertPlacement(aFolder(), chainOf(MAX_FOLDER_DEPTH), []);
		} catch (caught) {
			expect((caught as Error).message).toContain(String(MAX_FOLDER_DEPTH));

			return;
		}

		throw new Error("expected assertPlacement to throw");
	});
});

describe("restoreFolder", () => {
	test.each([
		["a root folder", () => aFolder()],
		["a child folder", () => aFolder({ parentId: toFolderId("root") })],
		["a renamed folder", () => renameFolder(aFolder(), "Renamed", laterAt)],
	])("restores %s the transitions produce", (_name, build) => {
		const expected = build();

		expect(
			restoreFolder({
				id: expected.id,
				name: expected.name,
				parentId: expected.parentId,
				createdAt: expected.createdAt,
				updatedAt: expected.updatedAt,
			}),
		).toEqual(expected);
	});

	test.each([
		["createdAt", { createdAt: invalidDate, updatedAt: createdAt }],
		["updatedAt", { createdAt, updatedAt: invalidDate }],
	])("rejects an invalid %s", (_field, dates) => {
		expect(() =>
			restoreFolder({ id: toFolderId("cat-1"), name: "English", ...dates }),
		).toThrow(FolderValidationError);
	});

	test("rejects an updatedAt before createdAt", () => {
		expect(() =>
			restoreFolder({
				id: toFolderId("cat-1"),
				name: "English",
				createdAt,
				updatedAt: earlierAt,
			}),
		).toThrow(FolderValidationError);
	});

	test("rejects a folder that is its own parent", () => {
		expect(() =>
			restoreFolder({
				id: toFolderId("cat-1"),
				name: "English",
				parentId: toFolderId("cat-1"),
				createdAt,
				updatedAt: createdAt,
			}),
		).toThrow(FolderCycleError);
	});

	test("rejects an empty name", () => {
		expect(() =>
			restoreFolder({
				id: toFolderId("cat-1"),
				name: "   ",
				createdAt,
				updatedAt: createdAt,
			}),
		).toThrow(FolderValidationError);
	});

	test("copies dates and freezes the restored folder", () => {
		const mutable = new Date(createdAt.getTime());
		const restored = restoreFolder({
			id: toFolderId("cat-1"),
			name: "English",
			createdAt: mutable,
			updatedAt: laterAt,
		});

		mutable.setFullYear(1999);

		expect(restored.createdAt).toEqual(createdAt);
		expect(Object.isFrozen(restored)).toBe(true);
	});
});
