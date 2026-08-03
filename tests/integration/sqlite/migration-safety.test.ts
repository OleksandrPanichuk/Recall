import type { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase } from "@/adapters/persistence/sqlite/database";
import {
	applyMigrations,
	UnsafeMigrationError,
} from "@/adapters/persistence/sqlite/migrator";

const baseMigration = [
	"CREATE TABLE `parents` (",
	"\t`id` text PRIMARY KEY NOT NULL,",
	"\t`status` text NOT NULL,",
	"\tCONSTRAINT \"parents_status_check\" CHECK(status IN ('draft', 'published'))",
	") STRICT;",
	"--> statement-breakpoint",
	"CREATE TABLE `children` (",
	"\t`id` text PRIMARY KEY NOT NULL,",
	"\t`parent_id` text NOT NULL,",
	"\tFOREIGN KEY (`parent_id`) REFERENCES `parents`(`id`) ON UPDATE no action ON DELETE cascade",
	") STRICT;",
].join("\n");

const rebuildMigration = [
	"PRAGMA foreign_keys=OFF;--> statement-breakpoint",
	"CREATE TABLE `__new_parents` (",
	"\t`id` text PRIMARY KEY NOT NULL,",
	"\t`status` text NOT NULL,",
	"\tCONSTRAINT \"parents_status_check\" CHECK(status IN ('draft', 'published', 'archived'))",
	");",
	"--> statement-breakpoint",
	'INSERT INTO `__new_parents`("id", "status") SELECT "id", "status" FROM `parents`;--> statement-breakpoint',
	"DROP TABLE `parents`;--> statement-breakpoint",
	"ALTER TABLE `__new_parents` RENAME TO `parents`;--> statement-breakpoint",
	"PRAGMA foreign_keys=ON;",
].join("\n");

const rebuildWithoutPragma = rebuildMigration
	.split("\n")
	.filter((line) => !line.startsWith("PRAGMA foreign_keys"))
	.join("\n");

const additiveMigration =
	"ALTER TABLE `parents` ADD `note` text;--> statement-breakpoint\nCREATE INDEX `idx_parents_status` ON `parents` (`status`);";

interface FixtureMigration {
	readonly tag: string;
	readonly sql: string;
}

let folder: string;
let databasePath: string;
let database: Database;

function writeMigrations(migrations: readonly FixtureMigration[]): void {
	mkdirSync(join(folder, "meta"), { recursive: true });

	for (const migration of migrations) {
		writeFileSync(join(folder, `${migration.tag}.sql`), migration.sql);
	}

	writeFileSync(
		join(folder, "meta", "_journal.json"),
		JSON.stringify({
			version: "7",
			dialect: "sqlite",
			entries: migrations.map((migration, index) => ({
				idx: index,
				version: "6",
				when: index + 1,
				tag: migration.tag,
				breakpoints: true,
			})),
		}),
	);
}

function seedGraph(): void {
	database.run("INSERT INTO parents (id, status) VALUES ('parent-1', 'draft')");
	database.run(
		"INSERT INTO children (id, parent_id) VALUES ('child-1', 'parent-1')",
	);
}

function countRows(table: string): number {
	const [row] = database
		.query<{ total: number }, []>(`SELECT count(*) AS total FROM ${table}`)
		.all();

	return row?.total ?? 0;
}

function appliedTags(): readonly string[] {
	return database
		.query<{ created_at: number }, []>(
			"SELECT created_at FROM __drizzle_migrations ORDER BY created_at",
		)
		.all()
		.map((row) => String(row.created_at));
}

beforeEach(() => {
	const directory = mkdtempSync(join(tmpdir(), "quiz-migrations-"));

	folder = join(directory, "drizzle");
	databasePath = join(directory, "quiz.sqlite");
	writeMigrations([{ tag: "0000_base", sql: baseMigration }]);
	database = createDatabase({ path: databasePath });

	expect(applyMigrations(database, folder)).toEqual(["0000_base"]);

	seedGraph();
});

afterEach(() => {
	database.close();
	rmSync(join(folder, ".."), { recursive: true, force: true });
});

describe("applyMigrations", () => {
	test("refuses a pending migration that toggles PRAGMA foreign_keys", () => {
		writeMigrations([
			{ tag: "0000_base", sql: baseMigration },
			{ tag: "0001_rebuild", sql: rebuildMigration },
		]);

		expect(() => applyMigrations(database, folder)).toThrow(
			UnsafeMigrationError,
		);
	});

	test("names the offending migration and the manual procedure", () => {
		writeMigrations([
			{ tag: "0000_base", sql: baseMigration },
			{ tag: "0001_rebuild", sql: rebuildMigration },
		]);

		expect(() => applyMigrations(database, folder)).toThrow(
			/0001_rebuild\.sql[\s\S]*README\.md/,
		);
	});

	test("refuses a pending migration that builds a __new_ table", () => {
		writeMigrations([
			{ tag: "0000_base", sql: baseMigration },
			{ tag: "0001_rebuild", sql: rebuildWithoutPragma },
		]);

		expect(() => applyMigrations(database, folder)).toThrow(
			UnsafeMigrationError,
		);
	});

	test("applies nothing when a rebuild migration is refused", () => {
		writeMigrations([
			{ tag: "0000_base", sql: baseMigration },
			{ tag: "0001_rebuild", sql: rebuildMigration },
		]);

		expect(() => applyMigrations(database, folder)).toThrow(
			UnsafeMigrationError,
		);
		expect(appliedTags()).toEqual(["1"]);
		expect(countRows("parents")).toBe(1);
		expect(countRows("children")).toBe(1);
	});

	test("refuses a rebuild even when an additive migration precedes it", () => {
		writeMigrations([
			{ tag: "0000_base", sql: baseMigration },
			{ tag: "0001_additive", sql: additiveMigration },
			{ tag: "0002_rebuild", sql: rebuildMigration },
		]);

		expect(() => applyMigrations(database, folder)).toThrow(
			/0002_rebuild\.sql/,
		);
		expect(appliedTags()).toEqual(["1"]);
	});

	test("still applies a normal additive migration", () => {
		writeMigrations([
			{ tag: "0000_base", sql: baseMigration },
			{ tag: "0001_additive", sql: additiveMigration },
		]);

		expect(applyMigrations(database, folder)).toEqual(["0001_additive"]);
		expect(countRows("children")).toBe(1);

		database.run("UPDATE parents SET note = 'kept' WHERE id = 'parent-1'");

		expect(applyMigrations(database, folder)).toEqual([]);
	});

	test("ignores a rebuild that was already applied before the guard existed", () => {
		writeMigrations([
			{ tag: "0000_base", sql: baseMigration },
			{ tag: "0001_rebuild", sql: rebuildMigration },
		]);
		database.run(
			"INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('legacy', 2)",
		);

		expect(applyMigrations(database, folder)).toEqual([]);
	});
});
