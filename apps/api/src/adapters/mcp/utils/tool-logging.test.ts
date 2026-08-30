import { describe, expect, test } from "bun:test";
import { createRecordingLogger } from "@tests/fixtures/logger.fixture";
import { ok } from "../presenters/tool-result.presenter";
import { createToolRunner, describeToolArgs } from "./tool-logging";

describe("describeToolArgs", () => {
	test("keeps the addressing arguments and the batch size", () => {
		expect(
			describeToolArgs({
				quizSetId: "set-1",
				questions: [{ prompt: "Which keyword freezes a binding?" }],
			}),
		).toMatchObject({ quizSetId: "set-1", questionCount: 1 });
	});

	test("never carries question content", () => {
		const fields = describeToolArgs({
			quizSetId: "set-1",
			questions: [{ prompt: "Which keyword freezes a binding?" }],
		});

		expect(JSON.stringify(fields)).not.toContain("freezes");
	});

	test("reads a folder path under either argument name", () => {
		expect(describeToolArgs({ path: ["English", "A1"] }).folderPath).toBe(
			"English / A1",
		);
		expect(describeToolArgs({ folderPath: ["English", "A1"] }).folderPath).toBe(
			"English / A1",
		);
	});

	test("survives a tool called without arguments", () => {
		expect(describeToolArgs(undefined)).toEqual({
			quizSetId: undefined,
			folderPath: undefined,
			name: undefined,
			questionCount: undefined,
			includeUnpublished: undefined,
		});
	});
});

describe("createToolRunner", () => {
	const elapsing = () => {
		let current = 1000;

		return () => {
			current += 3;

			return current;
		};
	};

	test("logs the call and its duration", async () => {
		const logger = createRecordingLogger();
		const runTool = createToolRunner(logger, elapsing());

		await runTool("quiz_get_set", { quizSetId: "set-1" }, async () =>
			ok("done"),
		);

		expect(logger.of("mcp tool").at(0)).toMatchObject({
			level: "info",
			tool: "quiz_get_set",
			quizSetId: "set-1",
			durationMs: 3,
			outcome: "ok",
		});
	});

	test("turns a thrown error into a failure result and an error record", async () => {
		const logger = createRecordingLogger();
		const runTool = createToolRunner(logger, elapsing());

		const result = await runTool("quiz_publish_set", {}, async () => {
			throw new Error("nothing to publish");
		});

		expect(result.isError).toBe(true);
		expect(logger.of("mcp tool failed").at(0)).toMatchObject({
			level: "error",
			tool: "quiz_publish_set",
			error: { name: "Error", message: "nothing to publish" },
		});
	});
});
