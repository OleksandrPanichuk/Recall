import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { EMPTY_ENV_FILE } from "@tests/fixtures/env-file";

const entrypoint = Bun.fileURLToPath(
	new URL("../src/main.ts", import.meta.url),
);

const ME = {
	id: 123456,
	is_bot: true,
	first_name: "Stub",
	username: "stub_bot",
};

interface Pending {
	text: string;
}

let telegram: Bun.TCPSocketListener<Pending>;
let dropsLeft = 0;
let polls = 0;

const reply = (result: unknown): string => {
	const body = JSON.stringify({ ok: true, result });

	return `HTTP/1.1 200 OK\r\ncontent-type: application/json\r\ncontent-length: ${Buffer.byteLength(body)}\r\n\r\n${body}`;
};

const methodOf = (request: string): string =>
	(request.split(" ")[1] ?? "").split("/").pop() ?? "";

beforeAll(() => {
	telegram = Bun.listen<Pending>({
		hostname: "127.0.0.1",
		port: 0,
		socket: {
			open(socket) {
				socket.data = { text: "" };
			},
			data(socket, chunk) {
				socket.data.text += chunk.toString();

				const headersEnd = socket.data.text.indexOf("\r\n\r\n");

				if (headersEnd === -1) {
					return;
				}

				const method = methodOf(socket.data.text);

				socket.data.text = "";

				if (method === "getMe") {
					socket.write(reply(ME));

					return;
				}

				if (method !== "getUpdates") {
					socket.write(reply(true));

					return;
				}

				if (dropsLeft > 0) {
					dropsLeft -= 1;

					socket.write("HTTP/1.1 200 OK\r\ncontent-length: 100\r\n\r\n{");
					setTimeout(() => socket.end(), 5);

					return;
				}

				polls += 1;

				socket.write(reply([]));
			},
		},
	});
});

afterAll(() => {
	telegram.stop(true);
});

const run = async (
	drops: number,
): Promise<{ exitCode: number; log: string }> => {
	dropsLeft = drops;
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
				TELEGRAM_API_ROOT: `http://127.0.0.1:${telegram.port}/`,
			},
			stdout: "pipe",
			stderr: "pipe",
		},
	);

	const deadline = Date.now() + 20_000;

	while (polls === 0 && Date.now() < deadline) {
		await Bun.sleep(50);
	}

	child.kill("SIGTERM");

	const [log, exitCode] = await Promise.all([
		new Response(child.stderr).text(),
		child.exited,
	]);

	return { exitCode, log };
};

describe.skipIf(process.platform === "win32")(
	"a long poll whose connection is dropped",
	() => {
		test("reconnects and goes on polling", async () => {
			const { exitCode, log } = await run(2);

			expect(polls).toBeGreaterThan(0);
			expect(log).toContain("telegram connection dropped, reconnecting");
			expect(exitCode).toBe(0);
		}, 30_000);

		test("is never reported as the bot having stopped", async () => {
			const { log } = await run(1);

			expect(log).not.toContain("bot stopped");
			expect(log).not.toContain("launch-failed");
		}, 30_000);
	},
);
