import { instantOf, localPartsIn } from "../utils/timezone";

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

export function millisecondsUntil(
	at: Date,
	hour: number,
	timezone: string,
): number {
	const parts = localPartsIn(at, timezone);
	const today = instantOf(
		parts.year ?? 1970,
		parts.month ?? 1,
		parts.day ?? 1,
		hour,
		timezone,
	).getTime();

	if (today > at.getTime()) {
		return today - at.getTime();
	}

	const tomorrow = new Date(
		Date.UTC(parts.year ?? 1970, (parts.month ?? 1) - 1, parts.day ?? 1) +
			DAY_MS,
	);

	return (
		instantOf(
			tomorrow.getUTCFullYear(),
			tomorrow.getUTCMonth() + 1,
			tomorrow.getUTCDate(),
			hour,
			timezone,
		).getTime() - at.getTime()
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
