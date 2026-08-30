import { describe, expect, test } from "bun:test";
import { EMPTY_ENV_FILE } from "@tests/fixtures/env-file";

const entrypoint = Bun.fileURLToPath(
	new URL("../src/main.ts", import.meta.url),
);

const botKey = "123456789:AA-startup-test-token";

const apiToken = "b".repeat(40);

const validEnvironment = {
	TELEGRAM_BOT_KEY: botKey,
	ALLOWED_TELEGRAM_USER_ID: "987654321",
	BOT_API_TOKEN: apiToken,
	RECALL_API_URL: "http://127.0.0.1:8767",
	APP_TIMEZONE: "Europe/Kyiv",
};

async function start(
	environment: Record<string, string>,
	args: readonly string[] = ["--check"],
) {
	const child = Bun.spawn(
		[process.execPath, `--env-file=${EMPTY_ENV_FILE}`, entrypoint, ...args],
		{
			env: environment,
			stdout: "pipe",
			stderr: "pipe",
		},
	);

	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);

	return { stdout, stderr, exitCode };
}

describe("bot startup", () => {
	test("validates a good environment and exits cleanly", async () => {
		const { stdout, exitCode } = await start(validEnvironment);

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Configuration is valid");
		expect(stdout).not.toContain(botKey);
		expect(stdout).not.toContain(apiToken);
	});

	test("refuses to start on an invalid environment", async () => {
		const { stderr, exitCode } = await start({
			...validEnvironment,
			APP_TIMEZONE: "Europe/Atlantis",
		});

		expect(exitCode).toBe(1);
		expect(stderr).toContain("Invalid bot configuration");
		expect(stderr).toContain("APP_TIMEZONE");
		expect(stderr).not.toContain(botKey);
	});

	test("reports a completely missing environment without leaking values", async () => {
		const { stderr, exitCode } = await start({});

		expect(exitCode).toBe(1);
		expect(stderr).toContain("TELEGRAM_BOT_KEY");
		expect(stderr).toContain("ALLOWED_TELEGRAM_USER_ID");
		expect(stderr).toContain("BOT_API_TOKEN");
		expect(stderr).toContain("APP_TIMEZONE");
	});
});

test("refuses an api token short enough to guess, without echoing it", async () => {
	const { stderr, exitCode } = await start({
		...validEnvironment,
		BOT_API_TOKEN: "short",
	});

	expect(exitCode).toBe(1);
	expect(stderr).toContain("BOT_API_TOKEN");
	expect(stderr).not.toContain("short");
});

test("refuses an api url that is not a url", async () => {
	const { stderr, exitCode } = await start({
		...validEnvironment,
		RECALL_API_URL: "not-a-url",
	});

	expect(exitCode).toBe(1);
	expect(stderr).toContain("RECALL_API_URL");
});
