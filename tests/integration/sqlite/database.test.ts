import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "@/adapters/persistence/sqlite/database";
import { applyMigrations } from "@/adapters/persistence/sqlite/migrator";

const projectRoot = join(import.meta.dir, "..", "..", "..");

const databaseModule = join(
	projectRoot,
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
});

describe("createDatabase", () => {
	test("keeps a live write-ahead log while the connection is open", () => {
		const path = join(directory, "quiz.sqlite");
		const database = createDatabase({ path });

		applyMigrations(database);

		const [row] = database
			.query<{ journal_mode: string }, []>("PRAGMA journal_mode")
			.all();

		expect(row?.journal_mode).toBe("wal");
		expect(existsSync(`${path}-wal`)).toBe(true);
		expect(existsSync(`${path}-shm`)).toBe(true);

		database.close();
	});

	test("opens the same file from concurrent processes without a lock error", async () => {
		const path = join(directory, "concurrent.sqlite");
		const source = [
			`const { createDatabase } = await import(${JSON.stringify(databaseModule)});`,
			`const database = createDatabase({ path: ${JSON.stringify(path)} });`,
			`database.run("CREATE TABLE IF NOT EXISTS probe (id TEXT NOT NULL PRIMARY KEY) STRICT");`,
			`database.run("INSERT OR REPLACE INTO probe (id) VALUES (?)", [String(process.pid)]);`,
			`console.log(database.query("PRAGMA journal_mode").all()[0].journal_mode);`,
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
				stdout: await new Response(child.stdout).text(),
				stderr: await new Response(child.stderr).text(),
			})),
		);

		for (const result of results) {
			expect(result.stderr).not.toContain("database is locked");
			expect(result.exitCode).toBe(0);
			expect(result.stdout.trim()).toBe("wal");
		}
	}, 30_000);
});

describe("the migrate command", () => {
	test("leaves a single database file behind", async () => {
		const path = join(directory, "quiz.sqlite");
		const child = Bun.spawn(["bun", "run", "./scripts/migrate.ts"], {
			cwd: projectRoot,
			stdout: "pipe",
			stderr: "pipe",
			env: {
				...process.env,
				TELEGRAM_BOT_KEY: "test-token",
				ALLOWED_TELEGRAM_USER_ID: "1",
				APP_TIMEZONE: "Europe/Kyiv",
				DATABASE_PATH: path,
			},
		});

		const exitCode = await child.exited;
		const stdout = await new Response(child.stdout).text();

		expect(exitCode).toBe(0);
		expect(stdout).toContain("0000_initial-schema");
		expect(readdirSync(directory)).toEqual(["quiz.sqlite"]);
	}, 30_000);
});
