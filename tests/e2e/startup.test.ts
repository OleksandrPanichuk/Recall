import { describe, expect, test } from "bun:test";

const entrypoint = Bun.fileURLToPath(
	new URL("../../src/entrypoints/telegram.ts", import.meta.url),
);

const botKey = "123456789:AA-startup-test-token";

const validEnvironment = {
	TELEGRAM_BOT_KEY: botKey,
	ALLOWED_TELEGRAM_USER_ID: "987654321",
	DATABASE_PATH: "./data/startup-test.sqlite",
	APP_TIMEZONE: "Europe/Kyiv",
};

async function start(environment: Record<string, string>) {
	const child = Bun.spawn(
		[process.execPath, "--env-file=/dev/null", entrypoint],
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

describe("telegram entrypoint startup", () => {
	test("starts with a valid environment", async () => {
		const { stdout, exitCode } = await start(validEnvironment);

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Configuration is valid");
		expect(stdout).not.toContain(botKey);
	});

	test("refuses to start on an invalid environment", async () => {
		const { stderr, exitCode } = await start({
			...validEnvironment,
			APP_TIMEZONE: "Europe/Atlantis",
		});

		expect(exitCode).toBe(1);
		expect(stderr).toContain("Invalid environment configuration");
		expect(stderr).toContain("APP_TIMEZONE");
		expect(stderr).not.toContain(botKey);
	});

	test("reports a completely missing environment without leaking values", async () => {
		const { stderr, exitCode } = await start({});

		expect(exitCode).toBe(1);
		expect(stderr).toContain("TELEGRAM_BOT_KEY");
		expect(stderr).toContain("ALLOWED_TELEGRAM_USER_ID");
		expect(stderr).toContain("DATABASE_PATH");
		expect(stderr).toContain("APP_TIMEZONE");
	});
});
