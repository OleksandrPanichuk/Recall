import type { FeltGrade } from "@recall/contracts";

export interface RecallChoice {
	readonly grade: FeltGrade;
	readonly label: string;
	readonly caption: string;
}

export const RECALL_CHOICES: readonly RecallChoice[] = [
	{ grade: "hard", label: "Важко", caption: "згадав через силу" },
	{ grade: "good", label: "Норм", caption: "згадав як завжди" },
	{ grade: "easy", label: "Легко", caption: "знав одразу" },
];
