import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { newestStamp } from "./backup.lib";

const CONTAINER = "recall-postgres";
const root = Bun.fileURLToPath(new URL("..", import.meta.url));

const dockerHasPostgres = async (): Promise<boolean> => {
	try {
		const child = Bun.spawn(
			["docker", "inspect", "-f", "{{.State.Running}}", CONTAINER],
			{ stdout: "pipe", stderr: "ignore" },
		);
		const stdout = await new Response(child.stdout).text();

		return (await child.exited) === 0 && stdout.trim() === "true";
	} catch {
		return false;
	}
};

const available = await dockerHasPostgres();
const database = `recall_probe_${Math.random().toString(36).slice(2, 10)}`;

const psql = async (
	sql: string,
	on = database,
): Promise<{ code: number; stdout: string }> => {
	const child = Bun.spawn(
		[
			"docker",
			"exec",
			CONTAINER,
			"psql",
			"-qtA",
			"-U",
			"recall",
			"-d",
			on,
			"-c",
			sql,
		],
		{ stdout: "pipe", stderr: "pipe" },
	);
	const stdout = await new Response(child.stdout).text();

	return { code: await child.exited, stdout: stdout.trim() };
};

const script = async (
	name: string,
	args: readonly string[],
): Promise<{ code: number; output: string }> => {
	const child = Bun.spawn(
		[process.execPath, `${root}scripts/${name}.ts`, ...args],
		{
			cwd: root,
			env: {
				...process.env,
				DATABASE_URL: `postgres://recall:recall@127.0.0.1:55432/${database}`,
			},
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [stdout, stderr, code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);

	return { code, output: `${stdout}${stderr}` };
};

let into: string;

beforeAll(async () => {
	if (!available) {
		return;
	}

	into = await mkdtemp(`${tmpdir()}/recall-backup-`);

	await psql(`create database ${database}`, "postgres");
	await psql(
		"create table souvenirs (id serial primary key, label text not null)",
	);
	await psql("insert into souvenirs (label) values ('from before the wipe')");
});

afterAll(async () => {
	if (!available) {
		return;
	}

	await psql(`drop database if exists ${database}`, "postgres");
	await rm(into, { recursive: true, force: true });
});

describe.skipIf(!available)("a backup taken and restored", () => {
	test("dumps the database DATABASE_URL names, not the compose default", async () => {
		const { code, output } = await script("backup", [
			"--into",
			into,
			"--no-uploads",
		]);

		expect(code).toBe(0);
		expect(output).toContain(database);
	});

	test("and the dump holds the actual rows, not a stringified stream", async () => {
		const stamp = newestStamp([
			...new Bun.Glob("*").scanSync({ cwd: into, onlyFiles: false }),
		]);
		const sql = await Bun.file(`${into}/${stamp}/postgres.sql`).text();

		expect(sql).toContain("from before the wipe");
		expect(sql).not.toContain("[object ReadableStream]");
		expect(sql).toContain("PostgreSQL database dump");
	});

	test("restore brings back a table that was dropped", async () => {
		await psql("drop table souvenirs");

		expect((await psql("select count(*) from souvenirs")).code).not.toBe(0);

		const { code, output } = await script("restore", [
			"--from",
			into,
			"--no-uploads",
			"--yes",
		]);

		expect(code).toBe(0);
		expect(output).toContain("restored");
		expect((await psql("select label from souvenirs")).stdout).toBe(
			"from before the wipe",
		);
	});

	test("restore refuses without --yes, so it cannot happen by accident", async () => {
		const { code, output } = await script("restore", ["--from", into]);

		expect(code).toBe(1);
		expect(output).toContain("--yes");
	});
});
