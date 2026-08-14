import type {
	QuizAttemptRepository,
	TopicAccuracy,
} from "@/application/ports/repositories/quiz-attempt.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { QuizAttemptId } from "@/domain/quiz-attempt/quiz-attempt";
import { percentageOf, type Score } from "@/domain/quiz-attempt/score";
import type { QuestionId } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { QuizSetNotFoundError } from "../quiz-sets/update-quiz-set";

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
	readonly attempts: readonly AttemptSummary[];
	readonly setAccuracy: Score;
	readonly topics: readonly TopicAccuracy[];
	readonly incorrectQuestionIds: readonly QuestionId[];
	readonly improvement?: Improvement;
}

export interface GetQuizStatisticsCommand {
	readonly telegramUserId: number;
	readonly quizSetId: QuizSetId;
}

export interface GetQuizStatisticsDependencies {
	readonly quizSets: QuizSetRepository;
	readonly attempts: QuizAttemptRepository;
}

const scoreOf = (correct: number, total: number): Score => ({
	correct,
	total,
	percentage: percentageOf(correct, total),
});

export class GetQuizStatistics
	implements UseCase<Command<GetQuizStatisticsCommand>, QuizStatistics>
{
	private readonly quizSets: QuizSetRepository;
	private readonly attempts: QuizAttemptRepository;

	constructor(dependencies: GetQuizStatisticsDependencies) {
		this.quizSets = dependencies.quizSets;
		this.attempts = dependencies.attempts;
	}

	async execute(
		request: Command<GetQuizStatisticsCommand>,
	): Promise<QuizStatistics> {
		if (this.quizSets.findById(request.quizSetId) === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		const completed = this.attempts.listCompletedBySet(
			request.telegramUserId,
			request.quizSetId,
		);
		const attempts = completed.map(
			(entry): AttemptSummary => ({
				attemptId: entry.attemptId,
				score: scoreOf(entry.correct, entry.total),
				completedAt: entry.completedAt,
			}),
		);

		return {
			attempts,
			setAccuracy: scoreOf(
				completed.reduce((sum, entry) => sum + entry.correct, 0),
				completed.reduce((sum, entry) => sum + entry.total, 0),
			),
			topics: this.attempts.topicAccuracy(request.telegramUserId),
			incorrectQuestionIds: this.attempts.incorrectQuestionIds(
				request.telegramUserId,
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
