import {
	type LogFields,
	type Logger,
	type LoggerOptions,
	LogLevel,
} from "./logger.types";
import { formatRecord } from "./utils/format-record";
import { clip, sanitiseFields } from "./utils/sanitise-fields";

const SEVERITY: Readonly<Record<LogLevel, number>> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

export function createLogger(options: LoggerOptions = {}): Logger {
	const minimum = SEVERITY[options.level ?? LogLevel.Info];
	const now = options.now ?? (() => new Date());
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
