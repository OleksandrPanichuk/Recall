import type { LogFields } from "../logger.types";

export const REDACTED = "[redacted]";

export const MAX_FIELD_LENGTH = 80;

const SENSITIVE_SUBSTRINGS = [
	"token",
	"secret",
	"password",
	"credential",
	"authorization",
] as const;

// Flattening makes `TELEGRAM_BOT_KEY` and `telegramBotKey` one name. A trailing
// "key" counts, a contained one does not — otherwise `keyboard` is redacted.
function isSensitiveKey(key: string): boolean {
	const flattened = key.toLowerCase().replaceAll(/[^a-z]/g, "");

	return (
		flattened.endsWith("key") ||
		SENSITIVE_SUBSTRINGS.some((needle) => flattened.includes(needle))
	);
}

export const clip = (value: string): string =>
	value.length <= MAX_FIELD_LENGTH
		? value
		: `${value.slice(0, MAX_FIELD_LENGTH)}…(+${value.length - MAX_FIELD_LENGTH})`;

function sanitiseValue(value: unknown, depth: number): unknown {
	if (value === null || value === undefined) {
		return value;
	}

	if (depth <= 0) {
		return "[nested]";
	}

	if (typeof value === "string") {
		return clip(value);
	}

	if (typeof value === "number" || typeof value === "boolean") {
		return value;
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (value instanceof Error) {
		return { name: value.name, message: clip(value.message) };
	}

	if (Array.isArray(value)) {
		return value.slice(0, 10).map((entry) => sanitiseValue(entry, depth - 1));
	}

	if (typeof value === "object") {
		return sanitiseFields(value as LogFields, depth - 1);
	}

	return "[unloggable]";
}

export function sanitiseFields(fields: LogFields, depth = 2): LogFields {
	const output: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(fields)) {
		output[key] = isSensitiveKey(key) ? REDACTED : sanitiseValue(value, depth);
	}

	return output;
}
