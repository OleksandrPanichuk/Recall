export const LogLevel = {
	Debug: "debug",
	Info: "info",
	Warn: "warn",
	Error: "error",
} as const;
export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
	debug(message: string, fields?: LogFields): void;
	info(message: string, fields?: LogFields): void;
	warn(message: string, fields?: LogFields): void;
	error(message: string, fields?: LogFields): void;
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
