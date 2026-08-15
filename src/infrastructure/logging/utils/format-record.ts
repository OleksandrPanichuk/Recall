import type { LogRecord } from "../logger.types";

const RESERVED_KEYS = new Set(["time", "level", "message"]);

// A caller's field must not be able to rename the level or restamp the time of
// the record that carries it, so the header always wins the name.
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
