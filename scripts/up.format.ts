const LEVEL_COLOURS: Readonly<Record<string, string>> = {
	error: "\u001b[31m",
	warn: "\u001b[33m",
	info: "\u001b[32m",
	debug: "\u001b[90m",
};

const NAME_COLOURS = [
	"\u001b[36m",
	"\u001b[35m",
	"\u001b[34m",
	"\u001b[33m",
] as const;

const RESET = "\u001b[0m";
const DIM = "\u001b[90m";
const MAX_VALUE_LENGTH = 96;

export interface LogLine {
	readonly time?: string;
	readonly level?: string;
	readonly message: string;
	readonly details: readonly string[];
}

const stringify = (value: unknown): string => {
	if (typeof value === "string") {
		return value;
	}

	return JSON.stringify(value) ?? String(value);
};

const clipped = (value: string): string =>
	value.length > MAX_VALUE_LENGTH
		? `${value.slice(0, MAX_VALUE_LENGTH - 1)}…`
		: value;

const clockOf = (time: unknown): string | undefined => {
	if (typeof time !== "string") {
		return undefined;
	}

	const parsed = new Date(time);

	return Number.isNaN(parsed.getTime())
		? undefined
		: parsed.toTimeString().slice(0, 8);
};

export function parseLogLine(line: string): LogLine | undefined {
	const trimmed = line.trim();

	if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
		return undefined;
	}

	let parsed: unknown;

	try {
		parsed = JSON.parse(trimmed);
	} catch {
		return undefined;
	}

	if (
		typeof parsed !== "object" ||
		parsed === null ||
		typeof (parsed as { message?: unknown }).message !== "string"
	) {
		return undefined;
	}

	const record = parsed as Record<string, unknown>;
	const details: string[] = [];

	for (const [key, value] of Object.entries(record)) {
		if (key === "time" || key === "level" || key === "message") {
			continue;
		}

		details.push(`${key}=${clipped(stringify(value))}`);
	}

	const time = clockOf(record.time);

	return {
		...(time === undefined ? {} : { time }),
		...(typeof record.level === "string" ? { level: record.level } : {}),
		message: String(record.message),
		details,
	};
}

export interface RenderOptions {
	readonly colour: boolean;
	readonly index?: number;
}

export function renderLine(
	name: string,
	width: number,
	line: string,
	options: RenderOptions,
): string {
	const parsed = parseLogLine(line);
	const paint = (colour: string, value: string): string =>
		options.colour ? `${colour}${value}${RESET}` : value;
	const label = paint(
		NAME_COLOURS[(options.index ?? 0) % NAME_COLOURS.length] ?? "",
		name.padEnd(width),
	);

	if (parsed === undefined) {
		return `${label}  ${line}`;
	}

	const head = [
		parsed.time === undefined ? undefined : paint(DIM, parsed.time),
		parsed.level === undefined
			? undefined
			: paint(LEVEL_COLOURS[parsed.level] ?? "", parsed.level.padEnd(5)),
		parsed.message,
	].filter((part): part is string => part !== undefined);
	const tail =
		parsed.details.length === 0
			? ""
			: `  ${paint(DIM, parsed.details.join(" "))}`;

	return `${label}  ${head.join(" ")}${tail}`;
}
