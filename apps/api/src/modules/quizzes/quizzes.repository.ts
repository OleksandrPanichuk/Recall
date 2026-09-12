import type { PageId } from "@/modules/pages";
import type { QuestionId } from "./question.entity";
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

export abstract class QuizzesRepository {
	abstract save(quiz: QuizSetEntity, expectedVersion?: number): Promise<number>;
	abstract findById(id: QuizSetId): Promise<QuizSetEntity | undefined>;
	abstract versionOf(id: QuizSetId): Promise<number | undefined>;
	abstract list(filter?: QuizListFilter): Promise<readonly QuizSummary[]>;
	abstract answerCount(questionId: QuestionId): Promise<number>;
}
