import { days as countedDays } from "@/shared/lib/plural";

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date): number =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export function retiredLabel(retiredAt: string, today: Date): string {
	const since = Math.max(
		0,
		Math.round((startOfDay(today) - startOfDay(new Date(retiredAt))) / DAY_MS),
	);

	if (since === 0) {
		return "retired today";
	}

	return since === 1
		? "retired yesterday"
		: `retired ${countedDays(since)} ago`;
}
