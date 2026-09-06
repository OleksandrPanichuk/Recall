import { mkdir, readdir, rm } from "node:fs/promises";
import {
	looksLikeDump,
	postgresTargetFrom,
	prunable,
	stampFor,
} from "./backup.lib";

const POSTGRES = "recall-postgres";
const MINIO = "recall-minio";
const DEFAULT_KEEP = 7;
const HEAD_BYTES = 512;

const argv = process.argv.slice(2);
const flagValue = (flag: string): string | undefined => {
	const at = argv.indexOf(flag);

	return at === -1 ? undefined : argv[at + 1];
};

const root = Bun.fileURLToPath(new URL("..", import.meta.url));
const into = flagValue("--into") ?? `${root}backups`;
const keep = Number(flagValue("--keep") ?? DEFAULT_KEEP);
const target = postgresTargetFrom(Bun.env.DATABASE_URL);

const say = (line: string): void => {
	console.log(line);
};

const fail = (line: string): never => {
	console.error(line);
	process.exit(1);
};

async function running(container: string): Promise<boolean> {
	const child = Bun.spawn(
		["docker", "inspect", "-f", "{{.State.Running}}", container],
		{ stdout: "pipe", stderr: "ignore" },
	);
	const stdout = await new Response(child.stdout).text();

	return (await child.exited) === 0 && stdout.trim() === "true";
}

async function dumpTo(
	command: readonly string[],
	destination: string,
): Promise<number> {
	const child = Bun.spawn([...command], {
		stdout: Bun.file(destination),
		stderr: "pipe",
	});
	const code = await child.exited;

	if (code !== 0) {
		const stderr = await new Response(child.stderr).text();

		await rm(destination, { force: true });
		fail(`${command[0]} exited ${code}\n${stderr.trim()}`);
	}

	const file = Bun.file(destination);
	const bytes = (await file.stat()).size;
	const head = await file.slice(0, HEAD_BYTES).text();

	if (!looksLikeDump(head)) {
		await rm(destination, { force: true });
		fail(
			`${destination} is ${bytes} bytes and does not start like a pg_dump — refusing to call it a backup`,
		);
	}

	return bytes;
}

async function run(command: readonly string[]): Promise<void> {
	const child = Bun.spawn([...command], { stdout: "ignore", stderr: "pipe" });
	const code = await child.exited;

	if (code !== 0) {
		fail(
			`${command.slice(0, 2).join(" ")} exited ${code}\n${(
				await new Response(child.stderr).text()
			).trim()}`,
		);
	}
}

const humanSize = (bytes: number): string =>
	bytes < 1_048_576
		? `${Math.round(bytes / 1024)} KiB`
		: `${(bytes / 1_048_576).toFixed(1)} MiB`;

if (!(await running(POSTGRES))) {
	fail(`${POSTGRES} is not running — start it with \`bun run db:up\``);
}

const stamp = stampFor(new Date());
const directory = `${into}/${stamp}`;

await mkdir(directory, { recursive: true });

const dump = `${directory}/postgres.sql`;

const written = await dumpTo(
	[
		"docker",
		"exec",
		POSTGRES,
		"pg_dump",
		"--clean",
		"--if-exists",
		"-U",
		target.user,
		target.database,
	],
	dump,
);
say(`postgres: ${target.database} → ${dump} (${humanSize(written)})`);

if (argv.includes("--no-uploads")) {
	say("minio: skipped (--no-uploads)");
} else if (await running(MINIO)) {
	const objects = `${directory}/minio`;

	await run(["docker", "cp", "-q", `${MINIO}:/data/.`, objects]);
	say(`minio: uploads copied to ${objects}`);
} else {
	say("minio: not running — uploads were not copied");
}

const gone = prunable(await readdir(into), keep);

for (const old of gone) {
	await rm(`${into}/${old}`, { recursive: true, force: true });
	say(`pruned ${old}`);
}

say("");
say(`backup ${stamp} written to ${directory}`);
say(`restore it with \`bun run restore ${stamp}\``);
