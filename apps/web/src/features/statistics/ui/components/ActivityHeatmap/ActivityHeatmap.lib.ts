export const dayLabel = (day: string): string =>
	new Intl.DateTimeFormat("uk-UA", {
		day: "numeric",
		month: "long",
		timeZone: "UTC",
	}).format(new Date(`${day}T00:00:00.000Z`));
