import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { createDatabase } from "@/adapters/persistence/sqlite/database";
import {
	appliedMigrations,
	type Migration,
	runMigrations,
} from "@/adapters/persistence/sqlite/migrations/migration";

let database: Database;

beforeEach(() => {
	database = createDatabase({ path: ":memory:" });
});

afterEach(() => {
	database.close();
});

const createExample: Migration = {
	version: 1,
	name: "example",
	up: (db) => db.run("CREATE TABLE example (id TEXT PRIMARY KEY)"),
};

/**
 * A table name cannot be a bound parameter, so it is interpolated here. Every
 * caller passes a literal from this file.
 */
const createTable = (
	version: number,
	name: string,
	table: string,
): Migration => ({
	version,
	name,
	up: (db) => db.run(`CREATE TABLE ${table} (id TEXT PRIMARY KEY)`),
});

const tableNames = (db: Database): readonly string[] =>
	db
		.query<{ name: string }, []>(
			"SELECT name FROM sqlite_master WHERE type = 'table'",
		)
		.all()
		.map((row) => row.name);

const foreignKeysEnabled = (db: Database): boolean =>
	db.query<{ foreign_keys: number }, []>("PRAGMA foreign_keys").get()
		?.foreign_keys === 1;

describe("createDatabase", () => {
	test("enables foreign key enforcement", () => {
		expect(foreignKeysEnabled(database)).toBe(true);
	});

	test("sets a busy timeout so a competing writer waits instead of failing", () => {
		const row = database
			.query<{ timeout: number }, []>("PRAGMA busy_timeout")
			.get();

		expect(row?.timeout).toBe(5000);
	});

	test("opens an in-memory database even though WAL cannot apply to it", () => {
		const row = database
			.query<{ journal_mode: string }, []>("PRAGMA journal_mode")
			.get();

		expect(row?.journal_mode).toBe("memory");
	});
});

describe("runMigrations", () => {
	test("applies pending migrations once", () => {
		expect(runMigrations(database, [createExample])).toHaveLength(1);
		expect(runMigrations(database, [createExample])).toHaveLength(0);
		expect(appliedMigrations(database).map((m) => m.version)).toEqual([1]);
	});

	test("reports the version, name and timestamp of what it applied", () => {
		const applied = runMigrations(database, [createExample]);

		expect(applied).toEqual([
			{ version: 1, name: "example", appliedAt: expect.any(String) },
		]);
		expect(applied[0]?.appliedAt).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
		);
		expect(appliedMigrations(database)).toEqual(applied);
	});

	test("rolls back a failing migration", () => {
		const broken: Migration = {
			version: 2,
			name: "broken",
			up: (db) => {
				db.run("CREATE TABLE half (id TEXT PRIMARY KEY)");
				throw new Error("boom");
			},
		};

		expect(() => runMigrations(database, [createExample, broken])).toThrow(
			"boom",
		);
		expect(appliedMigrations(database).map((m) => m.version)).toEqual([1]);
		expect(tableNames(database)).not.toContain("half");
		expect(tableNames(database)).toContain("example");
	});

	test("rejects duplicate versions before applying anything", () => {
		expect(() =>
			runMigrations(database, [createExample, { ...createExample }]),
		).toThrow("Duplicate migration version 1");
		expect(appliedMigrations(database)).toHaveLength(0);
	});

	test.each([
		[1.5, "a fractional version"],
		[-1, "a negative version"],
		[Number.NaN, "a version that is not a number"],
		[Number.MAX_SAFE_INTEGER + 2, "a version outside the safe integer range"],
	])("rejects %p before applying anything", (version) => {
		expect(() =>
			runMigrations(database, [
				createExample,
				{ ...createExample, version, name: "invalid" },
			]),
		).toThrow(`Invalid migration version ${version}`);
		expect(appliedMigrations(database)).toHaveLength(0);
		expect(tableNames(database)).not.toContain("example");
	});

	test("applies an out-of-order input array in ascending version order", () => {
		const applied = runMigrations(database, [
			createTable(2, "second", "second_table"),
			createTable(1, "first", "first_table"),
		]);

		expect(applied.map((m) => m.version)).toEqual([1, 2]);
		expect(appliedMigrations(database).map((m) => m.name)).toEqual([
			"first",
			"second",
		]);
	});

	test("applies only the migrations added since the previous call", () => {
		runMigrations(database, [createExample]);

		const applied = runMigrations(database, [
			createExample,
			createTable(2, "second", "second_table"),
		]);

		expect(applied.map((m) => m.version)).toEqual([2]);
		expect(appliedMigrations(database).map((m) => m.version)).toEqual([1, 2]);
	});

	test("keeps foreign key enforcement enabled", () => {
		runMigrations(database, [createExample]);

		expect(foreignKeysEnabled(database)).toBe(true);
	});
});

describe("appliedMigrations", () => {
	test("returns nothing for a database that was never migrated", () => {
		expect(appliedMigrations(database)).toEqual([]);
	});

	test("does not create the ledger table as a side effect of reading", () => {
		appliedMigrations(database);

		expect(tableNames(database)).not.toContain("schema_migrations");
	});
});

describe("a file-backed database", () => {
	const directory = "./tmp";
	const path = `${directory}/migration-runner-test.sqlite`;

	beforeEach(() => {
		mkdirSync(directory, { recursive: true });
	});

	afterEach(() => {
		// WAL leaves `-wal` and `-shm` sidecars next to the database on macOS.
		for (const suffix of ["", "-wal", "-shm"]) {
			rmSync(`${path}${suffix}`, { force: true });
		}
	});

	test("uses write-ahead logging", () => {
		const file = createDatabase({ path });

		try {
			const row = file
				.query<{ journal_mode: string }, []>("PRAGMA journal_mode")
				.get();

			expect(row?.journal_mode).toBe("wal");
		} finally {
			file.close();
		}
	});

	test("reports migrations applied by an earlier connection", () => {
		const first = createDatabase({ path });

		try {
			runMigrations(first, [createExample]);
		} finally {
			first.close();
		}

		const second = createDatabase({ path });

		try {
			expect(appliedMigrations(second).map((m) => m.version)).toEqual([1]);
			expect(runMigrations(second, [createExample])).toHaveLength(0);
			expect(tableNames(second)).toContain("example");
		} finally {
			second.close();
		}
	});
});
