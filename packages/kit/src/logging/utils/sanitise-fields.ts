import type { LogFields } from "../logger.types";

export const REDACTED = "[redacted]";

export const MAX_FIELD_LENGTH = 80;

export const MAX_ERROR_MESSAGE_LENGTH = 500;

export const MAX_ERROR_DEPTH = 3;

const ERROR_TAGS = ["code", "status", "errorName"] as const;

const SENSITIVE_SUBSTRINGS = [
	"token",
	"secret",
	"password",
	"credential",
	"authorization",
] as const;

function isSensitiveKey(key: string): boolean {
	const flattened = key.toLowerCase().replaceAll(/[^a-z]/g, "");

	return (
		flattened.endsWith("key") ||
		SENSITIVE_SUBSTRINGS.some((needle) => flattened.includes(needle))
	);
}

export const clip = (value: string, limit = MAX_FIELD_LENGTH): string =>
	value.length <= limit
		? value
		: `${value.slice(0, limit)}…(+${value.length - limit})`;

function sanitiseError(error: Error, depth: number): unknown {
	if (depth <= 0) {
		return "[nested]";
	}

	const output: Record<string, unknown> = {
		name: error.name,
		message: clip(error.message, MAX_ERROR_MESSAGE_LENGTH),
	};
	const carrier = error as unknown as Record<string, unknown>;

	for (const tag of ERROR_TAGS) {
		const value = carrier[tag];

		if (typeof value === "string") {
			output[tag] = clip(value);
		} else if (typeof value === "number") {
			output[tag] = value;
		}
	}

	if (error.cause !== undefined) {
		output.cause =
			error.cause instanceof Error
				? sanitiseError(error.cause, depth - 1)
				: sanitiseValue(error.cause, Math.min(depth - 1, 2));
	}

	return output;
}

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
		return sanitiseError(value, MAX_ERROR_DEPTH + 1);
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
