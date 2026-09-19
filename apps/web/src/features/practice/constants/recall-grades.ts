import type { RecallGrade } from "@recall/contracts";

export const RECALL_GRADES: readonly RecallGrade[] = [
	"again",
	"hard",
	"good",
	"easy",
];

export const RECALL_GRADE_LABELS: Readonly<Record<RecallGrade, string>> = {
	again: "Again",
	hard: "Hard",
	good: "Good",
	easy: "Easy",
};
