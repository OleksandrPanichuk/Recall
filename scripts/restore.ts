import { readdir, stat } from "node:fs/promises";
import { newestStamp, postgresTargetFrom, STAMP_PATTERN } from "./backup.lib";

const POSTGRES = "recall-postgres";
const MINIO = "recall-minio";

const argv = process.argv.slice(2);
const flagValue = (flag: string): string | undefined => {
	const at = argv.indexOf(flag);

	return at === -1 ? undefined : argv[at + 1];
};

const root = Bun.fileURLToPath(new URL("..", import.meta.url));
const from = flagValue("--from") ?? `${root}backups`;
const asked = argv.find((argument) => STAMP_PATTERN.test(argument));
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

async function feed(command: readonly string[], source: string): Promise<void> {
	const child = Bun.spawn([...command], {
		stdin: Bun.file(source),
		stdout: "ignore",
		stderr: "pipe",
	});
	const code = await child.exited;

	if (code !== 0) {
		fail(
			`${command.slice(0, 3).join(" ")} exited ${code}\n${(
				await new Response(child.stderr).text()
			).trim()}`,
		);
	}
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

const names = await readdir(from).catch(() => fail(`no backups in ${from}`));
const stamp = asked ?? newestStamp(names);

if (stamp === undefined) {
	fail(`no backups in ${from}`);
}

const directory = `${from}/${stamp}`;
const dump = `${directory}/postgres.sql`;

if (!(await Bun.file(dump).exists())) {
	fail(`${dump} is missing — ${stamp} is not a complete backup`);
}

if (!(await running(POSTGRES))) {
	fail(`${POSTGRES} is not running — start it with \`bun run db:up\``);
}

if (!argv.includes("--yes")) {
	say(`This replaces everything in the running database with ${stamp}.`);
	say("Re-run with --yes once you mean it.");
	process.exit(1);
}

await feed(
	[
		"docker",
		"exec",
		"-i",
		POSTGRES,
		"psql",
		"-q",
		"-U",
		target.user,
		target.database,
	],
	dump,
);
say(`postgres: ${target.database} restored from ${dump}`);

const objects = `${directory}/minio`;

if (argv.includes("--no-uploads")) {
	say("minio: skipped (--no-uploads)");
} else if (
	await stat(objects).then(
		() => true,
		() => false,
	)
) {
	if (await running(MINIO)) {
		await run(["docker", "cp", "-q", `${objects}/.`, `${MINIO}:/data`]);
		say(`minio: uploads restored from ${objects}`);
	} else {
		say("minio: not running — uploads were left alone");
	}
} else {
	say("minio: this backup has no uploads");
}

say("");
say(`restored ${stamp}`);
