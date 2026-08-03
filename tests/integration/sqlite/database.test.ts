import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "@/adapters/persistence/sqlite/database";
import { applyMigrations } from "@/adapters/persistence/sqlite/migrator";

const databaseModule = join(
	import.meta.dir,
	"..",
	"..",
	"..",
	"src",
	"adapters",
	"persistence",
	"sqlite",
	"database.ts",
);

let directory: string;

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), "quiz-sqlite-"));
});

afterEach(() => {
	rmSync(directory, { recursive: true, force: true });
});

describe("applyMigrations", () => {
	test("applies the initial migration once and is then idempotent", () => {
		const database = createDatabase({ path: ":memory:" });

		expect(applyMigrations(database)).toEqual(["0000_initial-schema"]);
		expect(applyMigrations(database)).toEqual([]);

		database.close();
	});

	test("leaves no database files behind for a file-backed run", () => {
		const path = join(directory, "quiz.sqlite");
		const database = createDatabase({ path });

		applyMigrations(database);
		database.close();

		expect(existsSync(path)).toBe(true);

		rmSync(path, { force: true });
		rmSync(`${path}-wal`, { force: true });
		rmSync(`${path}-shm`, { force: true });

		expect(existsSync(path)).toBe(false);
		expect(existsSync(`${path}-wal`)).toBe(false);
		expect(existsSync(`${path}-shm`)).toBe(false);
	});
});

describe("createDatabase", () => {
	test("opens the same file from concurrent processes without a lock error", async () => {
		const path = join(directory, "concurrent.sqlite");
		const source = [
			`const { createDatabase } = await import(${JSON.stringify(databaseModule)});`,
			`const database = createDatabase({ path: ${JSON.stringify(path)} });`,
			`database.run("CREATE TABLE IF NOT EXISTS probe (id TEXT NOT NULL PRIMARY KEY) STRICT");`,
			`database.run("INSERT OR REPLACE INTO probe (id) VALUES (?)", [String(process.pid)]);`,
			`database.close();`,
		].join("\n");

		const processes = Array.from({ length: 6 }, () =>
			Bun.spawn(["bun", "-e", source], {
				stdout: "pipe",
				stderr: "pipe",
			}),
		);

		const results = await Promise.all(
			processes.map(async (child) => ({
				exitCode: await child.exited,
				stderr: await new Response(child.stderr).text(),
			})),
		);

		for (const result of results) {
			expect(result.stderr).not.toContain("database is locked");
			expect(result.exitCode).toBe(0);
		}
	}, 30_000);
});
