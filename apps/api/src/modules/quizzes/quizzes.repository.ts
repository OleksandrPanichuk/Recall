import type { PageId } from "@/modules/pages";
import type { QuestionEntity, QuestionId } from "./question.entity";
import type { QuizSetStatus } from "./quiz-set.constants";
import type { QuizSetEntity, QuizSetId } from "./quiz-set.entity";

export interface QuizSummary {
	readonly id: QuizSetId;
	readonly title: string;
	readonly status: QuizSetStatus;
	readonly questionCount: number;
	readonly updatedAt: Date;
}

export interface QuizListFilter {
	readonly statuses?: readonly QuizSetStatus[];
	readonly pageId?: PageId | null;
	readonly ids?: readonly QuizSetId[];
}

export interface QuestionLocation {
	readonly questionId: QuestionId;
	readonly quizSetId: QuizSetId;
	readonly quizSetTitle: string;
	readonly quizSetStatus: QuizSetStatus;
	readonly prompt: string;
}

export interface ListedQuestion {
	readonly question: QuestionEntity;
	readonly quizSetId: QuizSetId;
	readonly setTitle: string;
	readonly setStatus: QuizSetStatus;
}

export interface QuestionListFilter {
	readonly quizSetId?: QuizSetId;
}

export abstract class QuizzesRepository {
	abstract save(quiz: QuizSetEntity, expectedVersion?: number): Promise<number>;
	abstract findById(id: QuizSetId): Promise<QuizSetEntity | undefined>;
	abstract versionOf(id: QuizSetId): Promise<number | undefined>;
	abstract list(filter?: QuizListFilter): Promise<readonly QuizSummary[]>;
	abstract answerCount(questionId: QuestionId): Promise<number>;
	abstract answerCounts(
		questionIds: readonly QuestionId[],
	): Promise<ReadonlyMap<QuestionId, number>>;
	abstract locateQuestions(
		questionIds: readonly QuestionId[],
	): Promise<readonly QuestionLocation[]>;
	abstract listQuestions(
		filter?: QuestionListFilter,
	): Promise<readonly ListedQuestion[]>;
}
