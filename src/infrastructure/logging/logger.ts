export const LogLevel = {
	Debug: "debug",
	Info: "info",
	Warn: "warn",
	Error: "error",
} as const;
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

const SEVERITY: Readonly<Record<LogLevel, number>> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
	debug(message: string, fields?: LogFields): void;
	info(message: string, fields?: LogFields): void;
	warn(message: string, fields?: LogFields): void;
	error(message: string, fields?: LogFields): void;
}

export const REDACTED = "[redacted]";

const SENSITIVE_SUBSTRINGS = [
	"token",
	"secret",
	"password",
	"credential",
	"authorization",
] as const;

/**
 * Anything whose name suggests a credential never reaches the output, whatever
 * it holds. Matching on the name rather than the value means a token that does
 * not look like one is still caught.
 *
 * Names are flattened first so `TELEGRAM_BOT_KEY` and `telegramBotKey` are the
 * same name. A trailing "key" counts, which catches those two without swallowing
 * innocent words that merely start with it, such as `keyboard`.
 */
function isSensitiveKey(key: string): boolean {
	const flattened = key.toLowerCase().replaceAll(/[^a-z]/g, "");

	return (
		flattened.endsWith("key") ||
		SENSITIVE_SUBSTRINGS.some((needle) => flattened.includes(needle))
	);
}

/**
 * Learning material is the bulk of what flows through this app — prompts, option
 * text, book extracts. None of it belongs in an operational log, so string
 * fields are clipped to a length that identifies without reproducing.
 */
export const MAX_FIELD_LENGTH = 80;

const clip = (value: string): string =>
	value.length <= MAX_FIELD_LENGTH
		? value
		: `${value.slice(0, MAX_FIELD_LENGTH)}…(+${value.length - MAX_FIELD_LENGTH})`;

function sanitiseValue(value: unknown, depth: number): unknown {
	if (value === null || value === undefined) {
		return value;
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
		// The stack can quote source lines, which may contain content.
		return { name: value.name, message: clip(value.message) };
	}

	if (depth <= 0) {
		return "[nested]";
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

export interface LogRecord {
	readonly level: LogLevel;
	readonly message: string;
	readonly time: string;
	readonly fields: LogFields;
}

export interface LoggerOptions {
	readonly level?: LogLevel;
	readonly now?: () => Date;
	readonly write?: (line: string) => void;
}

export function formatRecord(record: LogRecord): string {
	return JSON.stringify({
		time: record.time,
		level: record.level,
		message: record.message,
		...record.fields,
	});
}

export function createLogger(options: LoggerOptions = {}): Logger {
	const minimum = SEVERITY[options.level ?? LogLevel.Info];
	const now = options.now ?? (() => new Date());
	// stderr, so a bot log never corrupts the MCP protocol on stdout.
	const write =
		options.write ?? ((line: string) => process.stderr.write(`${line}\n`));

	const log = (level: LogLevel, message: string, fields?: LogFields): void => {
		if (SEVERITY[level] < minimum) {
			return;
		}

		write(
			formatRecord({
				level,
				message: clip(message),
				time: now().toISOString(),
				fields: sanitiseFields(fields ?? {}),
			}),
		);
	};

	return {
		debug: (message, fields) => {
			log(LogLevel.Debug, message, fields);
		},
		info: (message, fields) => {
			log(LogLevel.Info, message, fields);
		},
		warn: (message, fields) => {
			log(LogLevel.Warn, message, fields);
		},
		error: (message, fields) => {
			log(LogLevel.Error, message, fields);
		},
	};
}

export const silentLogger: Logger = {
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {},
};
