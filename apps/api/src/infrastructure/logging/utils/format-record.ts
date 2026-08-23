import type { LogRecord } from "../logger.types";

const RESERVED_KEYS = new Set(["time", "level", "message"]);

export function formatRecord(record: LogRecord): string {
	const fields = Object.entries(record.fields).filter(
		([key]) => !RESERVED_KEYS.has(key),
	);

	return JSON.stringify({
		time: record.time,
		level: record.level,
		message: record.message,
		...Object.fromEntries(fields),
	});
}
