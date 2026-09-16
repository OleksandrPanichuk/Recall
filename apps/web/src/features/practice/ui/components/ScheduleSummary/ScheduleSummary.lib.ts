import type { RecallGrade, ScheduledQuestion } from "@recall/contracts";
import { days } from "@/shared/lib/plural";

const DAY_MS = 24 * 60 * 60 * 1000;

export type GradeCounts = Readonly<Record<RecallGrade, number>>;

export interface DueGroup {
	readonly label: string;
	readonly questions: readonly ScheduledQuestion[];
}

export function gradeCounts(
	scheduled: readonly ScheduledQuestion[],
): GradeCounts {
	const counts = { again: 0, hard: 0, good: 0, easy: 0 };

	for (const question of scheduled) {
		counts[question.grade] += 1;
	}

	return counts;
}

const startOfDay = (date: Date): number =>
	new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const daysUntil = (dueAt: string, today: Date): number =>
	Math.max(
		0,
		Math.round((startOfDay(new Date(dueAt)) - startOfDay(today)) / DAY_MS),
	);

const labelFor = (inDays: number): string => {
	if (inDays === 0) {
		return "Today";
	}

	return inDays === 1 ? "Tomorrow" : `In ${days(inDays)}`;
};

export function groupByDue(
	scheduled: readonly ScheduledQuestion[],
	today: Date,
): readonly DueGroup[] {
	const byDay = new Map<number, ScheduledQuestion[]>();
	const retired: ScheduledQuestion[] = [];

	for (const question of scheduled) {
		if (question.dueAt === undefined) {
			retired.push(question);
			continue;
		}

		const inDays = daysUntil(question.dueAt, today);
		byDay.set(inDays, [...(byDay.get(inDays) ?? []), question]);
	}

	const dated = [...byDay.entries()]
		.toSorted(([left], [right]) => left - right)
		.map(([inDays, questions]) => ({ label: labelFor(inDays), questions }));

	return retired.length === 0
		? dated
		: [...dated, { label: "Retired", questions: retired }];
}
