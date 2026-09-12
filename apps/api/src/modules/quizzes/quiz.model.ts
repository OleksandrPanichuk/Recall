import type {
	QuizDetail as WireQuizDetail,
	QuizSummary as WireQuizSummary,
} from "@recall/contracts";
import { questionToWire } from "./question.model";
import type { QuizSetEntity } from "./quiz-set.entity";
import type { QuizSummary } from "./quizzes.repository";

const text = (value: string | undefined): string | undefined =>
	value === undefined ? undefined : value;

export const quizSummaryToWire = (summary: QuizSummary): WireQuizSummary => ({
	id: String(summary.id),
	title: summary.title,
	status: summary.status,
	questionCount: summary.questionCount,
	updatedAt: summary.updatedAt.toISOString(),
});

export const quizDetailToWire = (quiz: QuizSetEntity): WireQuizDetail => ({
	id: String(quiz.id),
	title: quiz.title,
	language: quiz.language,
	status: quiz.status,
	description: text(quiz.description),
	source: text(quiz.source),
	sourceChapters: text(quiz.sourceChapters),
	tags: [...quiz.tags],
	folderId: quiz.folderId === undefined ? undefined : String(quiz.folderId),
	questions: quiz.questions.map(questionToWire),
	updatedAt: quiz.updatedAt.toISOString(),
});
