import type { questionResponses, quizAttempts } from "../schema";

export type QuizAttemptRow = typeof quizAttempts.$inferSelect;
export type QuestionResponseRow = typeof questionResponses.$inferSelect;
export type QuizAttemptInsert = typeof quizAttempts.$inferInsert;
export type QuestionResponseInsert = typeof questionResponses.$inferInsert;

export interface TopicAccuracyRow {
	readonly topic: string | null;
	readonly answered: number;
	readonly correct: number;
}
