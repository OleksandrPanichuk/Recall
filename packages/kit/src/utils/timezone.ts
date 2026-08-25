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

export const offsetAt = (at: Date, timezone: string): number => {
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

export function instantOf(
	year: number,
	month: number,
	day: number,
	hour: number,
	timezone: string,
): Date {
	const wall = Date.UTC(year, month - 1, day, hour);
	const guess = wall - offsetAt(new Date(wall), timezone);

	return new Date(wall - offsetAt(new Date(guess), timezone));
}

export function startOfDayIn(at: Date, timezone: string): Date {
	const parts = partsIn(at, timezone);

	return instantOf(
		parts.year ?? 1970,
		parts.month ?? 1,
		parts.day ?? 1,
		0,
		timezone,
	);
}

export function localPartsIn(
	at: Date,
	timezone: string,
): Record<string, number> {
	return partsIn(at, timezone);
}
