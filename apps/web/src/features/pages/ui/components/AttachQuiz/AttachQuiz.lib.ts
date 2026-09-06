import type { BrowseView, QuizSummary } from "@recall/contracts";

export function attachableTo(
	view: BrowseView,
	sets: readonly QuizSummary[],
): readonly QuizSummary[] {
	const present = new Set([
		...view.sets.map((set) => set.id),
		...view.attached.map((set) => set.id),
	]);

	return sets.filter((set) => !present.has(set.id));
}
