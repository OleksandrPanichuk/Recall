import { createLogger, type Logger, LogLevel } from "@recall/kit";

export type LogRecordFields = Record<string, unknown>;

export interface RecordingLogger extends Logger {
	readonly lines: readonly string[];
	records(): readonly LogRecordFields[];
	of(message: string): readonly LogRecordFields[];
	text(): string;
}

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
