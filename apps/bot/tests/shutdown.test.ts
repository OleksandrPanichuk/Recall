import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { EMPTY_ENV_FILE } from "@tests/fixtures/env-file";

const entrypoint = Bun.fileURLToPath(
	new URL("../src/main.ts", import.meta.url),
);

let telegram: ReturnType<typeof Bun.serve>;
let polls = 0;

const answer = (result: unknown): Response =>
	Response.json({ ok: true, result });

beforeAll(() => {
	telegram = Bun.serve({
		port: 0,
		fetch: (request) => {
			const method = new URL(request.url).pathname.split("/").pop();

			if (method === "getMe") {
				return answer({
					id: 123456,
					is_bot: true,
					first_name: "Stub",
					username: "stub_bot",
				});
			}

			if (method === "getUpdates") {
				polls += 1;

				return answer([]);
			}

			return answer(true);
		},
	});
});

afterAll(() => {
	telegram.stop(true);
});

const run = async (
	signal: NodeJS.Signals,
): Promise<{ exitCode: number; log: string }> => {
	polls = 0;

	const child = Bun.spawn(
		[process.execPath, `--env-file=${EMPTY_ENV_FILE}`, entrypoint],
		{
			env: {
				TELEGRAM_BOT_KEY: "123456:stub",
				ALLOWED_TELEGRAM_USER_ID: "987654321",
				BOT_API_TOKEN: "b".repeat(40),
				RECALL_API_URL: "http://127.0.0.1:8767",
				APP_TIMEZONE: "Europe/Kyiv",
				TELEGRAM_API_ROOT: telegram.url.href,
			},
			stdout: "pipe",
			stderr: "pipe",
		},
	);

	while (polls === 0) {
		await Bun.sleep(50);
	}

	child.kill(signal);

	const [log, exitCode] = await Promise.all([
		new Response(child.stderr).text(),
		child.exited,
	]);

	return { exitCode, log };
};

describe.skipIf(process.platform === "win32")(
	"a long-polling bot told to stop",
	() => {
		test("exits zero on SIGTERM, which is what a container sends", async () => {
			const { exitCode, log } = await run("SIGTERM");

			expect(exitCode).toBe(0);
			expect(log).toContain("shutdown complete");
		});

		test("and never reports the abort as the bot having stopped", async () => {
			const { log } = await run("SIGTERM");

			expect(log).not.toContain("bot stopped");
			expect(log).not.toContain("readonly property");
		});

		test("exits zero on SIGINT too", async () => {
			const { exitCode } = await run("SIGINT");

			expect(exitCode).toBe(0);
		});
	},
);
