import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	closeDatabase,
	createDatabase,
} from "@/adapters/persistence/sqlite/database";
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
	test("applies every migration once and is then idempotent", () => {
		const database = createDatabase({ path: ":memory:" });

		expect(applyMigrations(database)).toEqual([
			"0000_initial-schema",
			"0001_drop-review-items",
			"0002_folders",
			"0003_question_types",
			"0004_skipped_responses",
			"0005_vocabulary_items",
			"0006_partial_credit",
		]);
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

	test("closes the handle even when compaction cannot run", () => {
		const path = join(directory, "quiz.sqlite");
		const database = createDatabase({ path });

		applyMigrations(database);
		database.run("BEGIN");

		expect(() => closeDatabase(database)).not.toThrow();
		expect(existsSync(path)).toBe(true);
		expect(() => database.query("SELECT 1").all()).toThrow();
	});

	test("does not remove a sidecar belonging to an unrelated path", () => {
		const pathA = join(directory, "database-a.sqlite");
		const pathB = join(directory, "database-b.sqlite");
		const databaseA = createDatabase({ path: pathA });

		writeFileSync(`${pathB}-shm`, "sentinel");

		const closeWithLegacyArguments = closeDatabase as unknown as (
			database: Database,
			path: string,
		) => void;
		closeWithLegacyArguments(databaseA, pathB);

		expect(existsSync(`${pathB}-shm`)).toBe(true);
	});

	test("closes a handle when SQLite setup fails after opening it", () => {
		const path = join(directory, "not-a-database.sqlite");
		writeFileSync(path, "not a SQLite database");

		const originalClose = Database.prototype.close;
		let capturedDatabase: Database | undefined;

		Database.prototype.close = function close(this: Database): void {
			capturedDatabase = this;
			originalClose.call(this);
		};

		try {
			expect(() => createDatabase({ path })).toThrow();
			expect(capturedDatabase).toBeDefined();
			expect(() => capturedDatabase?.query("SELECT 1").all()).toThrow();
		} finally {
			Database.prototype.close = originalClose;
		}
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
	test("leaves the migrated database behind", async () => {
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
		expect(readdirSync(directory)).toContain("quiz.sqlite");
	}, 30_000);
});

describe("createDatabase directory handling", () => {
	test("creates the directory the database lives in", () => {
		const directory = mkdtempSync(join(tmpdir(), "recall-nested-"));
		const path = join(directory, "deeply", "nested", "quiz.sqlite");

		const database = createDatabase({ path });

		expect(existsSync(path)).toBe(true);
		closeDatabase(database);
		rmSync(directory, { recursive: true, force: true });
	});
});
