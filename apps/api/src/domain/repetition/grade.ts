export const RecallGrade = {
	Again: "again",
	Hard: "hard",
	Good: "good",
	Easy: "easy",
} as const;
export type RecallGrade = (typeof RecallGrade)[keyof typeof RecallGrade];

export const FELT_GRADES: readonly RecallGrade[] = [
	RecallGrade.Hard,
	RecallGrade.Good,
	RecallGrade.Easy,
];

export const isFeltGrade = (value: unknown): value is RecallGrade =>
	FELT_GRADES.includes(value as RecallGrade);

export function gradeOf(
	answeredCorrectly: boolean,
	felt: RecallGrade | undefined,
): RecallGrade {
	if (!answeredCorrectly) {
		return RecallGrade.Again;
	}

	return felt === undefined || felt === RecallGrade.Again
		? RecallGrade.Good
		: felt;
}

export const wasRecalled = (grade: RecallGrade): boolean =>
	grade !== RecallGrade.Again;
