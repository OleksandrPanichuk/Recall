import { expect, test } from "bun:test";
import { LogLevel } from "../logger.types";
import { formatRecord } from "./format-record";

test("renders one flat JSON object with the fields beside the message", () => {
	const line = formatRecord({
		level: LogLevel.Info,
		message: "mcp tool",
		time: "2026-08-01T10:00:00.000Z",
		fields: { tool: "quiz_get_set", durationMs: 4 },
	});

	expect(JSON.parse(line)).toEqual({
		time: "2026-08-01T10:00:00.000Z",
		level: "info",
		message: "mcp tool",
		tool: "quiz_get_set",
		durationMs: 4,
	});
});

test("a field cannot overwrite the header of the record carrying it", () => {
	const line = formatRecord({
		level: LogLevel.Warn,
		message: "kept",
		time: "2026-08-01T10:00:00.000Z",
		fields: { message: "override", level: "debug", tool: "quiz_get_set" },
	});

	expect(JSON.parse(line)).toEqual({
		time: "2026-08-01T10:00:00.000Z",
		level: "warn",
		message: "kept",
		tool: "quiz_get_set",
	});
});
