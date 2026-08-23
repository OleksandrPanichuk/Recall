import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import {
	FolderDepthError,
	FolderValidationError,
} from "@/domain/folder/folder.errors";
import type { EnsureFolderPathUseCase } from "./ensure-folder-path";
import { createFoldersHarness, type FoldersHarness } from "./folders.fixture";

let context: MemoryContext;
let ensureFolderPath: EnsureFolderPathUseCase;
let nameOf: FoldersHarness["nameOf"];

beforeEach(() => {
	({ context, ensureFolderPath, nameOf } = createFoldersHarness());
});

afterEach(() => {
	context.close();
});

describe("EnsureFolderPathUseCase", () => {
	const path = ["English", "Vocabulary", "By levels", "A1"];

	test("creates the whole chain and reports every segment", async () => {
		const result = await ensureFolderPath.execute({ path });

		expect(result.created).toEqual(path);
		expect(await nameOf(result.folderId)).toBe("A1");
		expect(context.folders.listAncestors(result.folderId)).toHaveLength(3);
	});

	test("is idempotent", async () => {
		const first = await ensureFolderPath.execute({ path });
		const second = await ensureFolderPath.execute({ path });

		expect(second.folderId).toBe(first.folderId);
		expect(second.created).toEqual([]);
		expect(await context.scope.pages.listAll()).toHaveLength(4);
	});

	test("creates only the missing tail under an existing prefix", async () => {
		await ensureFolderPath.execute({ path: ["English", "Vocabulary"] });

		const result = await ensureFolderPath.execute({ path });

		expect(result.created).toEqual(["By levels", "A1"]);
	});

	test("matches existing segments case-insensitively", async () => {
		const first = await ensureFolderPath.execute({ path: ["English"] });
		const second = await ensureFolderPath.execute({ path: ["english"] });

		expect(second.folderId).toBe(first.folderId);
		expect(await nameOf(second.folderId)).toBe("English");
	});

	test("rejects an empty path", () => {
		expect(ensureFolderPath.execute({ path: [] })).rejects.toBeInstanceOf(
			Error,
		);
	});

	test("creates nothing when a later segment is invalid", () => {
		expect(
			ensureFolderPath.execute({ path: ["New", "Deep", "z".repeat(61)] }),
		).rejects.toBeInstanceOf(FolderValidationError);

		expect(await context.scope.pages.listAll()).toEqual([]);
	});

	test("rejects a path deeper than the limit", () => {
		expect(
			ensureFolderPath.execute({
				path: ["a", "b", "c", "d", "e", "f", "g"],
			}),
		).rejects.toBeInstanceOf(FolderDepthError);
	});
});
