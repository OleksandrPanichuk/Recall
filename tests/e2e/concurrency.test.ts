import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const worker = Bun.fileURLToPath(
	new URL("./concurrent-writer.ts", import.meta.url),
);

let directory: string;
let databasePath: string;

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), "recall-concurrency-"));
	databasePath = join(directory, "quiz.sqlite");
});

afterEach(() => {
	rmSync(directory, { recursive: true, force: true });
});

interface WorkerResult {
	readonly tag: string;
	readonly committed: number;
	readonly locked: number;
}

async function run(tag: string, rounds: number): Promise<WorkerResult> {
	const child = Bun.spawn(
		[process.execPath, worker, tag, String(rounds), databasePath],
		{ stdout: "pipe", stderr: "pipe" },
	);
	const [out, , code] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);

	if (code !== 0) {
		throw new Error(`worker ${tag} exited with ${code}`);
	}

	return JSON.parse(out.trim().split("\n").at(-1) ?? "{}") as WorkerResult;
}

describe("two processes sharing one database", () => {
	test("both migrate and write without losing anything", async () => {
		const rounds = 30;
		const [first, second] = await Promise.all([
			run("bot", rounds),
			run("mcp", rounds),
		]);

		expect(first.locked).toBe(0);
		expect(second.locked).toBe(0);
		expect(first.committed).toBe(rounds);
		expect(second.committed).toBe(rounds);
	}, 30_000);
});
