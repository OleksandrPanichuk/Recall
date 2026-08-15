import { createLogger } from "@/infrastructure/logging/logger";
import { type Logger, LogLevel } from "@/infrastructure/logging/logger.types";

export type LogRecordFields = Record<string, unknown>;

export interface RecordingLogger extends Logger {
	readonly lines: readonly string[];
	records(): readonly LogRecordFields[];
	of(message: string): readonly LogRecordFields[];
	text(): string;
}

// Records what the real logger would write, so a test sees the redacted and
// clipped output rather than the fields the caller handed over.
export function createRecordingLogger(
	level: LogLevel = LogLevel.Debug,
): RecordingLogger {
	const lines: string[] = [];
	const logger = createLogger({ level, write: (line) => lines.push(line) });
	const records = (): readonly LogRecordFields[] =>
		lines.map((line) => JSON.parse(line) as LogRecordFields);

	return {
		...logger,
		lines,
		records,
		of: (message) => records().filter((record) => record.message === message),
		text: () => lines.join("\n"),
	};
}
