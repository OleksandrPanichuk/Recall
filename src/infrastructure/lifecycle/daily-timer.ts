export interface DailyTimerOptions {
	readonly hour: number;
	readonly timezone: string;
	readonly now: () => Date;
	readonly run: () => Promise<void>;
	readonly onError?: (error: unknown) => void;
}

export interface DailyTimer {
	stop(): void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const partsIn = (at: Date, timezone: string): Record<string, number> => {
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		hour12: false,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	const parts: Record<string, number> = {};

	for (const part of formatter.formatToParts(at)) {
		if (part.type !== "literal") {
			parts[part.type] = Number(part.value);
		}
	}

	return parts;
};

const offsetAt = (at: Date, timezone: string): number => {
	const parts = partsIn(at, timezone);

	return (
		Date.UTC(
			parts.year ?? 1970,
			(parts.month ?? 1) - 1,
			parts.day ?? 1,
			parts.hour ?? 0,
			parts.minute ?? 0,
			parts.second ?? 0,
		) - at.getTime()
	);
};

function instantOf(
	year: number,
	month: number,
	day: number,
	hour: number,
	timezone: string,
): number {
	const wall = Date.UTC(year, month - 1, day, hour);
	const guess = wall - offsetAt(new Date(wall), timezone);
	const corrected = wall - offsetAt(new Date(guess), timezone);

	return corrected;
}

export function millisecondsUntil(
	at: Date,
	hour: number,
	timezone: string,
): number {
	const parts = partsIn(at, timezone);
	const today = instantOf(
		parts.year ?? 1970,
		parts.month ?? 1,
		parts.day ?? 1,
		hour,
		timezone,
	);

	if (today > at.getTime()) {
		return today - at.getTime();
	}

	const tomorrow = partsIn(new Date(at.getTime() + DAY_MS), timezone);

	return (
		instantOf(
			tomorrow.year ?? 1970,
			tomorrow.month ?? 1,
			tomorrow.day ?? 1,
			hour,
			timezone,
		) - at.getTime()
	);
}

export function startDailyTimer(options: DailyTimerOptions): DailyTimer {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;

	const schedule = (): void => {
		if (stopped) {
			return;
		}

		timer = setTimeout(
			() => {
				void options
					.run()
					.catch((error: unknown) => options.onError?.(error))
					.finally(schedule);
			},
			millisecondsUntil(options.now(), options.hour, options.timezone),
		);

		timer.unref?.();
	};

	schedule();

	return {
		stop(): void {
			stopped = true;

			if (timer !== undefined) {
				clearTimeout(timer);
			}
		},
	};
}
