import type { LogFields, Logger } from "@recall/kit";
import { failure, type ToolResult } from "../presenters/tool-result.presenter";

export type ToolRunner = (
	tool: string,
	args: unknown,
	run: () => Promise<ToolResult>,
) => Promise<ToolResult>;

const asRecord = (args: unknown): Readonly<Record<string, unknown>> =>
	typeof args === "object" && args !== null
		? (args as Record<string, unknown>)
		: {};

export function describeToolArgs(args: unknown): LogFields {
	const record = asRecord(args);
	const path = record.folderPath ?? record.path;

	return {
		quizSetId:
			typeof record.quizSetId === "string" ? record.quizSetId : undefined,
		folderPath: Array.isArray(path) ? path.join(" / ") : undefined,
		name: typeof record.name === "string" ? record.name : undefined,
		questionCount: Array.isArray(record.questions)
			? record.questions.length
			: undefined,
		includeUnpublished:
			typeof record.includeUnpublished === "boolean"
				? record.includeUnpublished
				: undefined,
	};
}

export function createToolRunner(
	logger: Logger,
	now: () => number = () => Date.now(),
): ToolRunner {
	return async (tool, args, run) => {
		const startedAt = now();
		const fields = { tool, ...describeToolArgs(args) };

		logger.debug("mcp tool called", fields);

		try {
			const result = await run();

			logger.info("mcp tool", {
				...fields,
				durationMs: now() - startedAt,
				outcome: "ok",
			});

			return result;
		} catch (error) {
			logger.error("mcp tool failed", {
				...fields,
				durationMs: now() - startedAt,
				error,
			});

			return failure(error);
		}
	};
}
