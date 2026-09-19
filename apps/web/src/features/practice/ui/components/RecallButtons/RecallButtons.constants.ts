import type { FeltGrade } from "@recall/contracts";
import { RECALL_GRADE_LABELS } from "@/features/practice/constants/recall-grades";

export interface RecallChoice {
	readonly grade: FeltGrade;
	readonly label: string;
	readonly caption: string;
}

export const RECALL_CHOICES: readonly RecallChoice[] = [
	{ grade: "hard", label: RECALL_GRADE_LABELS.hard, caption: "dragged it up" },
	{
		grade: "good",
		label: RECALL_GRADE_LABELS.good,
		caption: "came back as usual",
	},
	{
		grade: "easy",
		label: RECALL_GRADE_LABELS.easy,
		caption: "knew it at once",
	},
];
