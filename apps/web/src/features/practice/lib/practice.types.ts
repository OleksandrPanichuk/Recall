export interface Answer {
	readonly selectedOptionPositions?: readonly number[];
	readonly typedAnswer?: string;
	readonly revealed?: boolean;
}

export interface FinishedAttempt {
	readonly attemptId: string;
	readonly correct: number;
	readonly total: number;
	readonly percentage: number;
}
