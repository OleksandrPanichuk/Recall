import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { TestContext } from "@tests/fixtures/application.fixture";
import { createFoldersHarness, type FoldersHarness } from "./folders.fixture";
import {
	FolderPathNotFoundError,
	type ResolveFolderPath,
} from "./resolve-folder-path";

let context: TestContext;
let resolveFolderPath: ResolveFolderPath;
let create: FoldersHarness["create"];
let chain: FoldersHarness["chain"];

beforeEach(() => {
	({ context, resolveFolderPath, create, chain } = createFoldersHarness());
});

afterEach(() => {
	context.close();
});

describe("ResolveFolderPath", () => {
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

		expect(context.folders.listAll()).toHaveLength(1);
	});
});
