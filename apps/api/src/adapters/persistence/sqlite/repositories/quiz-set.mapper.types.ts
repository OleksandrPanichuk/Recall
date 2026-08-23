import type { questionOptions, questions, quizSets } from "../schema";

export type QuizSetRow = typeof quizSets.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;
export type QuestionOptionRow = typeof questionOptions.$inferSelect;
export type QuizSetInsert = typeof quizSets.$inferInsert;
export type QuestionInsert = typeof questions.$inferInsert;
export type QuestionOptionInsert = typeof questionOptions.$inferInsert;

export interface QuizSetSummaryRow {
	readonly id: string;
	readonly title: string;
	readonly status: string;
	readonly questionCount: number;
	readonly updatedAt: string;
}
