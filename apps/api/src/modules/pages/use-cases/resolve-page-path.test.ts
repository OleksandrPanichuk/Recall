import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { MemoryContext } from "@tests/fixtures/memory.fixture";
import { FolderPathNotFoundError } from "../pages.errors";
import { createPagesHarness, type PagesHarness } from "./pages.fixture";
import type { ResolvePagePathUseCase } from "./resolve-page-path";

let context: MemoryContext;
let resolvePagePath: ResolvePagePathUseCase;
let create: PagesHarness["create"];
let chain: PagesHarness["chain"];

beforeEach(() => {
	({ context, resolvePagePath, create, chain } = createPagesHarness());
});

afterEach(() => {
	context.close();
});

describe("ResolvePagePathUseCase", () => {
	test("returns the folder at the path", async () => {
		const levels = await chain("English", "Vocabulary", "By levels");

		expect(
			(
				await resolvePagePath.execute({
					path: ["English", "Vocabulary", "By levels"],
				})
			).folderId,
		).toBe(levels);
	});

	test("matches every segment case-insensitively", async () => {
		const levels = await chain("English", "Vocabulary", "By levels");

		expect(
			(
				await resolvePagePath.execute({
					path: ["ENGLISH", "vocabulary", "bY LeVeLs"],
				})
			).folderId,
		).toBe(levels);
	});

	test("returns an intermediate folder for a prefix", async () => {
		const english = await create("English");
		await create("Vocabulary", english);

		expect(
			(await resolvePagePath.execute({ path: ["English"] })).folderId,
		).toBe(english);
	});

	test("rejects an unknown tail", async () => {
		await create("English");

		expect(
			resolvePagePath.execute({ path: ["English", "Missing"] }),
		).rejects.toBeInstanceOf(FolderPathNotFoundError);
	});

	test("never creates anything", async () => {
		await create("English");

		await resolvePagePath
			.execute({ path: ["English", "Missing"] })
			.catch(() => undefined);

		expect(await context.scope.pages.listAll()).toHaveLength(1);
	});
});
