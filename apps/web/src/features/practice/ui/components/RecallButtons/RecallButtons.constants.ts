import type { FeltGrade } from "@recall/contracts";

export interface RecallChoice {
	readonly grade: FeltGrade;
	readonly label: string;
	readonly caption: string;
}

export const RECALL_CHOICES: readonly RecallChoice[] = [
	{ grade: "hard", label: "Hard", caption: "dragged it up" },
	{ grade: "good", label: "Good", caption: "came back as usual" },
	{ grade: "easy", label: "Easy", caption: "knew it at once" },
];
