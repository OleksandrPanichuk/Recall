import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import { createFoldersHarness, type FoldersHarness } from "./folders.fixture";
import {
	FolderPathNotFoundError,
	type ResolveFolderPathUseCase,
} from "./resolve-folder-path";

let context: MemoryContext;
let resolveFolderPath: ResolveFolderPathUseCase;
let create: FoldersHarness["create"];
let chain: FoldersHarness["chain"];

beforeEach(() => {
	({ context, resolveFolderPath, create, chain } = createFoldersHarness());
});

afterEach(() => {
	context.close();
});

describe("ResolveFolderPathUseCase", () => {
	test("returns the folder at the path", async () => {
		const levels = await chain("English", "Vocabulary", "By levels");

		expect(
			(
				await resolveFolderPath.execute({
					path: ["English", "Vocabulary", "By levels"],
				})
			).folderId,
		).toBe(levels);
	});

	test("matches every segment case-insensitively", async () => {
		const levels = await chain("English", "Vocabulary", "By levels");

		expect(
			(
				await resolveFolderPath.execute({
					path: ["ENGLISH", "vocabulary", "bY LeVeLs"],
				})
			).folderId,
		).toBe(levels);
	});

	test("returns an intermediate folder for a prefix", async () => {
		const english = await create("English");
		await create("Vocabulary", english);

		expect(
			(await resolveFolderPath.execute({ path: ["English"] })).folderId,
		).toBe(english);
	});

	test("rejects an unknown tail", async () => {
		await create("English");

		expect(
			resolveFolderPath.execute({ path: ["English", "Missing"] }),
		).rejects.toBeInstanceOf(FolderPathNotFoundError);
	});

	test("never creates anything", async () => {
		await create("English");

		await resolveFolderPath
			.execute({ path: ["English", "Missing"] })
			.catch(() => undefined);

		expect(await context.scope.pages.listAll()).toHaveLength(1);
	});
});
