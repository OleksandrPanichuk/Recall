export const shortDay = (day: string): string =>
	new Intl.DateTimeFormat("uk-UA", {
		day: "numeric",
		timeZone: "UTC",
	}).format(new Date(`${day}T00:00:00.000Z`));

export const fullDay = (day: string): string =>
	new Intl.DateTimeFormat("uk-UA", {
		weekday: "long",
		day: "numeric",
		month: "long",
		timeZone: "UTC",
	}).format(new Date(`${day}T00:00:00.000Z`));
