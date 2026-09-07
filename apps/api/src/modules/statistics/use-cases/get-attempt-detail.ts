import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import type { Score } from "@/modules/attempts";
import {
	AttemptEntity,
	AttemptsRepository,
	type QuizAttemptId,
} from "@/modules/attempts";
import {
	QuestionEntity,
	type QuestionOptionId,
	type QuizSetId,
	QuizzesRepository,
} from "@/modules/quizzes";

export class AttemptNotFoundError extends Error {
	readonly attemptId: QuizAttemptId;

	constructor(attemptId: QuizAttemptId) {
		super(`Attempt ${attemptId} does not exist`);
		this.name = "AttemptNotFoundError";
		this.attemptId = attemptId;
	}
}

export interface AnsweredQuestion {
	readonly question: QuestionEntity;
	readonly answered: boolean;
	readonly isCorrect: boolean;
	readonly skipped: boolean;
	readonly typedAnswer?: string;
	readonly selectedOptionIds: readonly QuestionOptionId[];
	readonly creditEarned: number;
	readonly creditPossible: number;
}

export interface AttemptDetail {
	readonly attemptId: QuizAttemptId;
	readonly quizSetId: QuizSetId;
	readonly quizSetTitle: string;
	readonly score: Score;
	readonly completedAt?: Date;
	readonly answers: readonly AnsweredQuestion[];
}

export interface GetAttemptDetailUseCaseOptions {
	readonly attemptId: QuizAttemptId;
}

type Options = GetAttemptDetailUseCaseOptions;

@Injectable()
export class GetAttemptDetailUseCase extends UseCase<Options, AttemptDetail> {
	constructor(
		private readonly attempts: AttemptsRepository,
		private readonly quizzes: QuizzesRepository,
	) {
		super();
	}

	async execute(options: Options): Promise<AttemptDetail> {
		const attempt = await this.attempts.findById(options.attemptId);

		if (attempt === undefined) {
			throw new AttemptNotFoundError(options.attemptId);
		}

		const quizSet = await this.quizzes.findById(attempt.quizSetId);
		const byId = new Map(
			(quizSet?.questions ?? []).map((question) => [question.id, question]),
		);

		const answers: AnsweredQuestion[] = [];

		for (const questionId of attempt.questionIds) {
			const question = byId.get(questionId);

			if (question === undefined) {
				continue;
			}

			const response = attempt.responses.find(
				(candidate) => candidate.questionId === questionId,
			);

			answers.push({
				question,
				answered: response !== undefined,
				isCorrect: response?.isCorrect ?? false,
				skipped: response?.skipped === true,
				typedAnswer: response?.typedAnswer,
				selectedOptionIds: response?.selectedOptionIds ?? [],
				creditEarned:
					response?.creditEarned ?? (response?.isCorrect === true ? 1 : 0),
				creditPossible: response?.creditPossible ?? 1,
			});
		}

		return {
			attemptId: attempt.id,
			quizSetId: attempt.quizSetId,
			quizSetTitle: quizSet?.title ?? "—",
			score: AttemptEntity.score(attempt),
			completedAt: attempt.completedAt,
			answers,
		};
	}
}
