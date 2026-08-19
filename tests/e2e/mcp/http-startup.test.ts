import { describe, expect, test } from "bun:test";

const entrypoint = Bun.fileURLToPath(
	new URL("../../../src/entrypoints/mcp-http.ts", import.meta.url),
);

const token = "s".repeat(40);

const validEnvironment = {
	TELEGRAM_BOT_KEY: "123456789:AA-startup-test-token",
	ALLOWED_TELEGRAM_USER_ID: "987654321",
	DATABASE_PATH: ":memory:",
	APP_TIMEZONE: "Europe/Kyiv",
	MCP_HTTP_TOKEN: token,
};

async function start(
	environment: Record<string, string>,
	args: readonly string[] = ["--check"],
) {
	const child = Bun.spawn(
		[process.execPath, "--env-file=/dev/null", entrypoint, ...args],
		{ env: environment, stdout: "pipe", stderr: "pipe" },
	);

	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
		child.exited,
	]);

	return { stdout, stderr, exitCode };
}

describe("mcp http entrypoint startup", () => {
	test("validates a good environment and exits cleanly", async () => {
		const { stdout, exitCode } = await start(validEnvironment);

		expect(exitCode).toBe(0);
		expect(stdout).toContain("Configuration is valid");
	});

	test("never prints the token it was given", async () => {
		const { stdout, stderr } = await start(validEnvironment);

		expect(stdout).not.toContain(token);
		expect(stderr).not.toContain(token);
	});

	test("reports the loopback default and the port it would bind", async () => {
		const { stdout } = await start(validEnvironment);

		expect(stdout).toContain("127.0.0.1");
		expect(stdout).toContain("8765");
	});

	test("refuses to start without a token", async () => {
		const { MCP_HTTP_TOKEN: _omitted, ...withoutToken } = validEnvironment;
		const { stderr, exitCode } = await start(withoutToken);

		expect(exitCode).toBe(1);
		expect(stderr).toContain("MCP_HTTP_TOKEN");
	});

	test("refuses a token short enough to guess", async () => {
		const { stderr, exitCode } = await start({
			...validEnvironment,
			MCP_HTTP_TOKEN: "short",
		});

		expect(exitCode).toBe(1);
		expect(stderr).toContain("MCP_HTTP_TOKEN");
		expect(stderr).not.toContain("short");
	});

	test("still refuses a broken shared environment", async () => {
		const { stderr, exitCode } = await start({
			...validEnvironment,
			APP_TIMEZONE: "Europe/Atlantis",
		});

		expect(exitCode).toBe(1);
		expect(stderr).toContain("APP_TIMEZONE");
	});
});
