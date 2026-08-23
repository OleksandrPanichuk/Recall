export const QuizAttemptStatus = {
	Active: "active",
	Paused: "paused",
	Completed: "completed",
} as const;
export type QuizAttemptStatus =
	(typeof QuizAttemptStatus)[keyof typeof QuizAttemptStatus];

export function isQuizAttemptStatus(
	value: unknown,
): value is QuizAttemptStatus {
	return (Object.values(QuizAttemptStatus) as readonly unknown[]).includes(
		value,
	);
}

export const QuizAttemptMode = {
	Full: "full",
	Mistakes: "mistakes",
	WeakTopics: "weak_topics",
} as const;
export type QuizAttemptMode =
	(typeof QuizAttemptMode)[keyof typeof QuizAttemptMode];

export function isQuizAttemptMode(value: unknown): value is QuizAttemptMode {
	return (Object.values(QuizAttemptMode) as readonly unknown[]).includes(value);
}
