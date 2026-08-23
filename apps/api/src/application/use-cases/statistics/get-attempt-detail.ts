import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Command, UseCase } from "@/application/use-case";
import {
	attemptScore,
	type QuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { Score } from "@/domain/quiz-attempt/score";
import type { Question, QuestionOptionId } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";

export class AttemptNotFoundError extends Error {
	readonly attemptId: QuizAttemptId;

	constructor(attemptId: QuizAttemptId) {
		super(`Attempt ${attemptId} does not exist`);
		this.name = "AttemptNotFoundError";
		this.attemptId = attemptId;
	}
}

export interface AnsweredQuestion {
	readonly question: Question;
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

export interface GetAttemptDetailCommand {
	readonly telegramUserId: number;
	readonly attemptId: QuizAttemptId;
}

export interface GetAttemptDetailDependencies {
	readonly attempts: QuizAttemptRepository;
	readonly quizSets: QuizSetRepository;
}

export class GetAttemptDetail
	implements UseCase<Command<GetAttemptDetailCommand>, AttemptDetail>
{
	private readonly attempts: QuizAttemptRepository;
	private readonly quizSets: QuizSetRepository;

	constructor(dependencies: GetAttemptDetailDependencies) {
		this.attempts = dependencies.attempts;
		this.quizSets = dependencies.quizSets;
	}

	async execute(
		request: Command<GetAttemptDetailCommand>,
	): Promise<AttemptDetail> {
		const attempt = this.attempts.findById(request.attemptId);

		if (
			attempt === undefined ||
			attempt.telegramUserId !== request.telegramUserId
		) {
			throw new AttemptNotFoundError(request.attemptId);
		}

		const quizSet = this.quizSets.findById(attempt.quizSetId);
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
			score: attemptScore(attempt),
			completedAt: attempt.completedAt,
			answers,
		};
	}
}
