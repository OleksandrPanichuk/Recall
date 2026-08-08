import { ReviewItemValidationError } from "./review.errors";

export const ReviewRating = {
	Hard: "hard",
	Good: "good",
	Easy: "easy",
} as const;
export type ReviewRating = (typeof ReviewRating)[keyof typeof ReviewRating];

export function isReviewRating(value: unknown): value is ReviewRating {
	return (Object.values(ReviewRating) as readonly unknown[]).includes(value);
}

/** Rule-based intervals. FSRS or SM-2 stays a later phase, per the plan. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 21] as const;

const lastIndex = REVIEW_INTERVALS_DAYS.length - 1;

const clamp = (value: number): number =>
	Math.min(Math.max(value, 0), lastIndex);

interface ZonedParts {
	readonly year: number;
	readonly month: number;
	readonly day: number;
	readonly hour: number;
	readonly minute: number;
	readonly second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timezone: string): Intl.DateTimeFormat {
	const cached = formatters.get(timezone);

	if (cached !== undefined) {
		return cached;
	}

	const created = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	});

	formatters.set(timezone, created);

	return created;
}

function zonedParts(at: Date, timezone: string): ZonedParts {
	const parts = formatterFor(timezone).formatToParts(at);
	const read = (type: Intl.DateTimeFormatPartTypes): number =>
		Number(parts.find((part) => part.type === type)?.value ?? 0);

	return {
		year: read("year"),
		month: read("month"),
		day: read("day"),
		hour: read("hour"),
		minute: read("minute"),
		second: read("second"),
	};
}

/** How far the zone is ahead of UTC at this instant, in milliseconds. */
function offsetMs(at: Date, timezone: string): number {
	const parts = zonedParts(at, timezone);
	const asIfUtc = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second,
	);

	return asIfUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/**
 * The UTC instant of local midnight on a given calendar date. Resolved in two
 * passes because the offset depends on the instant we are still solving for —
 * one pass lands on the wrong side of a DST change.
 */
function localMidnight(
	year: number,
	month: number,
	day: number,
	timezone: string,
): Date {
	const wallClock = Date.UTC(year, month - 1, day);
	const firstGuess = wallClock - offsetMs(new Date(wallClock), timezone);
	const resolved = new Date(
		wallClock - offsetMs(new Date(firstGuess), timezone),
	);
	const landed = zonedParts(resolved, timezone);

	// Some zones spring forward at 00:00, so local midnight does not exist that
	// day and the resolver lands on 23:00 the day before — which would schedule a
	// review into the past and make the question unanswerable. Step forward to the
	// first instant of the requested day that does exist.
	if (landed.year !== year || landed.month !== month || landed.day !== day) {
		return new Date(resolved.getTime() + HOUR_MS);
	}

	return resolved;
}

const HOUR_MS = 60 * 60 * 1000;

export function startOfDayInTimezone(at: Date, timezone: string): Date {
	const parts = zonedParts(at, timezone);

	return localMidnight(parts.year, parts.month, parts.day, timezone);
}

export interface NextDueOptions {
	/** The streak the item carries *after* the review being scheduled. */
	readonly streak: number;
	readonly rating: ReviewRating;
	readonly at: Date;
	readonly timezone: string;
}

const intervalIndexOf = (streak: number, rating: ReviewRating): number => {
	switch (rating) {
		case ReviewRating.Hard:
			return 0;
		case ReviewRating.Good:
			return clamp(streak - 1);
		case ReviewRating.Easy:
			// Never the shortest rung: "easy" on a question just missed still means
			// "don't show me this tomorrow", so it must outrank a hard rating.
			return clamp(Math.max(streak, 1));
	}
};

/**
 * Cards fall due at the start of a day in the user's own timezone rather than
 * at the clock time of the last review, so "due tomorrow" means the morning
 * rather than late tonight.
 */
export function nextReviewDueAt(options: NextDueOptions): Date {
	if (Number.isNaN(options.at.getTime())) {
		throw new ReviewItemValidationError(["at must be a valid date"]);
	}

	if (!Number.isSafeInteger(options.streak) || options.streak < 0) {
		throw new ReviewItemValidationError([
			"streak must be a non-negative integer",
		]);
	}

	const days =
		REVIEW_INTERVALS_DAYS[intervalIndexOf(options.streak, options.rating)];

	if (days === undefined) {
		throw new ReviewItemValidationError(["rating must be a supported rating"]);
	}

	const parts = zonedParts(options.at, options.timezone);
	// Date.UTC normalises an overflowing day, so month and year roll over for us.
	const shifted = new Date(
		Date.UTC(parts.year, parts.month - 1, parts.day + days),
	);

	return localMidnight(
		shifted.getUTCFullYear(),
		shifted.getUTCMonth() + 1,
		shifted.getUTCDate(),
		options.timezone,
	);
}
