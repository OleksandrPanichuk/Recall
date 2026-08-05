import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Command, UseCase } from "@/application/use-case";
import {
	currentQuestionId,
	type QuizAttemptId,
	type QuizAttemptStatus,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { Question } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type { AttemptOfUserCommand } from "./resume-quiz-attempt";

export interface CurrentQuestionView {
	readonly attemptId: QuizAttemptId;
	readonly quizSetId: QuizSetId;
	readonly quizSetTitle: string;
	readonly status: QuizAttemptStatus;
	readonly question: Question;
	/** Zero-based position in the attempt's plan. */
	readonly index: number;
	readonly total: number;
}

export interface GetCurrentQuestionDependencies {
	readonly quizSets: QuizSetRepository;
	readonly attempts: QuizAttemptRepository;
}

/**
 * The screen the Telegram adapter renders while an attempt is running. Resolves
 * to undefined when the user has no unfinished attempt, or has answered every
 * planned question and only has finishing left.
 */
export class GetCurrentQuestion
	implements
		UseCase<Command<AttemptOfUserCommand>, CurrentQuestionView | undefined>
{
	private readonly quizSets: QuizSetRepository;
	private readonly attempts: QuizAttemptRepository;

	constructor(dependencies: GetCurrentQuestionDependencies) {
		this.quizSets = dependencies.quizSets;
		this.attempts = dependencies.attempts;
	}

	async execute(
		request: Command<AttemptOfUserCommand>,
	): Promise<CurrentQuestionView | undefined> {
		const attempt = this.attempts.findActiveByUser(request.telegramUserId);

		if (attempt === undefined) {
			return undefined;
		}

		const questionId = currentQuestionId(attempt);

		if (questionId === undefined) {
			return undefined;
		}

		const quizSet = this.quizSets.findById(attempt.quizSetId);
		const question = quizSet?.questions.find(
			(candidate) => candidate.id === questionId,
		);

		if (quizSet === undefined || question === undefined) {
			return undefined;
		}

		return {
			attemptId: attempt.id,
			quizSetId: quizSet.id,
			quizSetTitle: quizSet.title,
			status: attempt.status,
			question,
			index: attempt.responses.length,
			total: attempt.questionIds.length,
		};
	}
}
