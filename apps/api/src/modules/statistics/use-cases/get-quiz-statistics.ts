import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import type { QuizAttemptId, TopicAccuracy } from "@/modules/attempts";
import { AttemptsRepository, Score } from "@/modules/attempts";
import { type PageId } from "@/modules/pages";
import {
	type QuestionId,
	type QuizSetId,
	QuizSetNotFoundError,
	QuizzesRepository,
} from "@/modules/quizzes";

export interface AttemptSummary {
	readonly attemptId: QuizAttemptId;
	readonly score: Score;
	readonly completedAt?: Date;
}

export interface Improvement {
	readonly firstPercentage: number;
	readonly lastPercentage: number;
	readonly deltaPercentage: number;
}

export interface QuizStatistics {
	readonly quizSetId: QuizSetId;
	readonly title: string;
	readonly folderId?: PageId;
	readonly attempts: readonly AttemptSummary[];
	readonly setAccuracy: Score;
	readonly topics: readonly TopicAccuracy[];
	readonly incorrectQuestionIds: readonly QuestionId[];
	readonly improvement?: Improvement;
}

export interface GetQuizStatisticsUseCaseOptions {
	readonly quizSetId: QuizSetId;
}

const scoreOf = (correct: number, total: number): Score => ({
	correct,
	total,
	percentage: Score.percentageOf(correct, total),
});

type Options = GetQuizStatisticsUseCaseOptions;

@Injectable()
export class GetQuizStatisticsUseCase extends UseCase<Options, QuizStatistics> {
	constructor(
		private readonly attemptRepository: AttemptsRepository,
		private readonly quizzes: QuizzesRepository,
	) {
		super();
	}

	async execute(options: Options): Promise<QuizStatistics> {
		const quizSet = await this.quizzes.findById(options.quizSetId);

		if (quizSet === undefined) {
			throw new QuizSetNotFoundError(options.quizSetId);
		}

		const completed = await this.attemptRepository.listCompletedForQuiz(
			options.quizSetId,
		);
		const attempts = completed.map(
			(entry): AttemptSummary => ({
				attemptId: entry.attemptId,
				score: scoreOf(entry.correct, entry.total),
				completedAt: entry.completedAt,
			}),
		);

		return {
			quizSetId: quizSet.id,
			title: quizSet.title,
			folderId: quizSet.folderId,
			attempts,
			setAccuracy: scoreOf(
				completed.reduce((sum, entry) => sum + entry.correct, 0),
				completed.reduce((sum, entry) => sum + entry.total, 0),
			),
			topics: await this.attemptRepository.topicAccuracy(options.quizSetId),
			incorrectQuestionIds: await this.attemptRepository.incorrectQuestionIds(
				options.quizSetId,
			),
			improvement: improvementOf(attempts),
		};
	}
}

function improvementOf(
	attempts: readonly AttemptSummary[],
): Improvement | undefined {
	const first = attempts[0];
	const last = attempts.at(-1);

	if (attempts.length < 2 || first === undefined || last === undefined) {
		return undefined;
	}

	return {
		firstPercentage: first.score.percentage,
		lastPercentage: last.score.percentage,
		deltaPercentage:
			Math.round((last.score.percentage - first.score.percentage) * 10) / 10,
	};
}
