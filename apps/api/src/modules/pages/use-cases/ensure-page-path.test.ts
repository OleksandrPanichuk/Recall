import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import {
	createPagesHarness,
	type PagesHarness,
} from "@tests/fixtures/pages.use-cases";
import { FolderDepthError, FolderValidationError } from "../pages.errors";
import type { EnsurePagePathUseCase } from "./ensure-page-path";

let context: MemoryContext;
let ensurePagePath: EnsurePagePathUseCase;
let nameOf: PagesHarness["nameOf"];

beforeEach(() => {
	({ context, ensurePagePath, nameOf } = createPagesHarness());
});

afterEach(() => {
	context.close();
});

describe("EnsurePagePathUseCase", () => {
	const path = ["English", "Vocabulary", "By levels", "A1"];

	test("creates the whole chain and reports every segment", async () => {
		const result = await ensurePagePath.execute({ path });

		expect(result.created).toEqual(path);
		expect(await nameOf(result.folderId)).toBe("A1");
		expect(
			await context.scope.pages.listAncestors(result.folderId),
		).toHaveLength(3);
	});

	test("is idempotent", async () => {
		const first = await ensurePagePath.execute({ path });
		const second = await ensurePagePath.execute({ path });

		expect(second.folderId).toBe(first.folderId);
		expect(second.created).toEqual([]);
		expect(await context.scope.pages.listAll()).toHaveLength(4);
	});

	test("creates only the missing tail under an existing prefix", async () => {
		await ensurePagePath.execute({ path: ["English", "Vocabulary"] });

		const result = await ensurePagePath.execute({ path });

		expect(result.created).toEqual(["By levels", "A1"]);
	});

	test("matches existing segments case-insensitively", async () => {
		const first = await ensurePagePath.execute({ path: ["English"] });
		const second = await ensurePagePath.execute({ path: ["english"] });

		expect(second.folderId).toBe(first.folderId);
		expect(await nameOf(second.folderId)).toBe("English");
	});

	test("rejects an empty path", () => {
		expect(ensurePagePath.execute({ path: [] })).rejects.toBeInstanceOf(Error);
	});

	test("creates nothing when a later segment is invalid", async () => {
		await expect(
			ensurePagePath.execute({ path: ["New", "Deep", "z".repeat(61)] }),
		).rejects.toBeInstanceOf(FolderValidationError);

		expect(await context.scope.pages.listAll()).toEqual([]);
	});

	test("rejects a path deeper than the limit", () => {
		expect(
			ensurePagePath.execute({
				path: ["a", "b", "c", "d", "e", "f", "g"],
			}),
		).rejects.toBeInstanceOf(FolderDepthError);
	});
});
