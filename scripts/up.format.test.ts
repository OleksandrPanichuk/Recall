import { describe, expect, test } from "bun:test";
import { parseLogLine, renderLine } from "./up.format";

const LINE = JSON.stringify({
	time: "2026-08-21T20:58:57.776Z",
	level: "info",
	message: "admin ready",
	host: "127.0.0.1",
	port: 8766,
});

describe("reading a child log line", () => {
	test("pulls the level, message and the rest as details", () => {
		const parsed = parseLogLine(LINE);

		expect(parsed?.level).toBe("info");
		expect(parsed?.message).toBe("admin ready");
		expect(parsed?.details).toEqual(["host=127.0.0.1", "port=8766"]);
		expect(parsed?.time).toMatch(/^\d\d:\d\d:\d\d$/);
	});

	test("renders arrays and objects rather than dropping them", () => {
		const parsed = parseLogLine(
			JSON.stringify({
				message: "database ready",
				appliedMigrations: ["0001"],
			}),
		);

		expect(parsed?.details).toEqual(['appliedMigrations=["0001"]']);
	});

	test("clips a value long enough to wrap the terminal", () => {
		const parsed = parseLogLine(
			JSON.stringify({ message: "ready", path: "x".repeat(400) }),
		);

		expect(parsed?.details[0]?.length).toBeLessThan(120);
		expect(parsed?.details[0]).toEndWith("…");
	});

	test("leaves a line that is not a log record alone", () => {
		expect(
			parseLogLine("Opening database at ./data/quiz.sqlite"),
		).toBeUndefined();
		expect(parseLogLine("{not json}")).toBeUndefined();
		expect(parseLogLine(JSON.stringify({ level: "info" }))).toBeUndefined();
	});
});

describe("rendering a child log line", () => {
	test("puts the service first and the details last", () => {
		const rendered = renderLine("admin", 5, LINE, { colour: false });

		expect(rendered).toBe(
			`admin  ${parseLogLine(LINE)?.time} info  admin ready  host=127.0.0.1 port=8766`,
		);
	});

	test("aligns names to the widest one", () => {
		expect(renderLine("bot", 5, "plain output", { colour: false })).toBe(
			"bot    plain output",
		);
	});

	test("passes plain output through untouched", () => {
		expect(
			renderLine("bot", 3, "applied 1 migration(s):", { colour: false }),
		).toBe("bot  applied 1 migration(s):");
	});

	test("adds colour only when asked", () => {
		const plain = renderLine("mcp", 3, LINE, { colour: false });
		const painted = renderLine("mcp", 3, LINE, { colour: true, index: 1 });

		expect(plain).not.toInclude("\u001b[");
		expect(painted).toInclude("\u001b[");
		// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI is the point
		expect(painted.replace(/\u001b\[\d+m/g, "")).toBe(plain);
	});
});
