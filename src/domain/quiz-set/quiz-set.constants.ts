export const QuizSetStatus = {
	Draft: "draft",
	Published: "published",
	Archived: "archived",
} as const;
export type QuizSetStatus = (typeof QuizSetStatus)[keyof typeof QuizSetStatus];

export function isQuizSetStatus(value: unknown): value is QuizSetStatus {
	return (Object.values(QuizSetStatus) as readonly unknown[]).includes(value);
}
