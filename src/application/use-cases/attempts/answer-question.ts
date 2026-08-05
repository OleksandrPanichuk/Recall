import type { Clock } from "@/application/ports/clock";
import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { Command, UseCase } from "@/application/use-case";
import { correctOptionIds, evaluateAnswer } from "@/domain/quiz-attempt/answer";
import {
	attemptScore,
	currentQuestionId,
	type QuizAttempt,
	type QuizAttemptStatus,
	recordResponse,
	QuizAttemptStatus as Status,
} from "@/domain/quiz-attempt/quiz-attempt";
import { QuestionNotInAttemptError } from "@/domain/quiz-attempt/quiz-attempt.errors";
import type { Score } from "@/domain/quiz-attempt/score";
import type {
	Question,
	QuestionId,
	QuestionOptionId,
} from "@/domain/quiz-set/question";
import { NoActiveAttemptError } from "./resume-quiz-attempt";

export class AttemptNotActiveError extends Error {
	constructor(status: QuizAttemptStatus) {
		super(`A ${status} attempt cannot record an answer`);
		this.name = "AttemptNotActiveError";
	}
}

export interface AnswerQuestionCommand {
	readonly telegramUserId: number;
	readonly questionId: QuestionId;
	readonly selectedOptionIds: readonly QuestionOptionId[];
}

export interface AnswerQuestionResult {
	readonly isCorrect: boolean;
	readonly alreadyAnswered: boolean;
	readonly explanation?: string;
	readonly correctOptionIds: readonly QuestionOptionId[];
	readonly nextQuestionId?: QuestionId;
	readonly score: Score;
}

export interface AnswerQuestionDependencies {
	readonly quizSets: QuizSetRepository;
	readonly attempts: QuizAttemptRepository;
	readonly clock: Clock;
	readonly transaction: Transaction;
}

export class AnswerQuestion
	implements UseCase<Command<AnswerQuestionCommand>, AnswerQuestionResult>
{
	private readonly quizSets: QuizSetRepository;
	private readonly attempts: QuizAttemptRepository;
	private readonly clock: Clock;
	private readonly transaction: Transaction;

	constructor(dependencies: AnswerQuestionDependencies) {
		this.quizSets = dependencies.quizSets;
		this.attempts = dependencies.attempts;
		this.clock = dependencies.clock;
		this.transaction = dependencies.transaction;
	}

	async execute(
		request: Command<AnswerQuestionCommand>,
	): Promise<AnswerQuestionResult> {
		const at = this.clock.now();

		return this.transaction.run(() => {
			const attempt = this.attempts.findActiveByUser(request.telegramUserId);

			if (attempt === undefined) {
				throw new NoActiveAttemptError(request.telegramUserId);
			}

			if (attempt.status !== Status.Active) {
				throw new AttemptNotActiveError(attempt.status);
			}

			const quizSet = this.quizSets.findById(attempt.quizSetId);
			const question = quizSet?.questions.find(
				(candidate) => candidate.id === request.questionId,
			);

			if (question === undefined) {
				throw new QuestionNotInAttemptError();
			}

			// A duplicated or stale callback replays an answer already recorded. Report
			// what was recorded rather than re-evaluating, so the outcome the user was
			// shown can never change under them and the score can never move twice.
			const recorded = attempt.responses.find(
				(response) => response.questionId === request.questionId,
			);

			if (recorded !== undefined) {
				return this.resultOf(attempt, recorded.isCorrect, true, question);
			}

			const isCorrect = evaluateAnswer(question, request.selectedOptionIds);
			const answered = recordResponse(attempt, {
				questionId: request.questionId,
				selectedOptionIds: request.selectedOptionIds,
				isCorrect,
				answeredAt: at,
			});

			this.attempts.save(answered);

			return this.resultOf(answered, isCorrect, false, question);
		});
	}

	private resultOf(
		attempt: QuizAttempt,
		isCorrect: boolean,
		alreadyAnswered: boolean,
		question: Question,
	): AnswerQuestionResult {
		return {
			isCorrect,
			alreadyAnswered,
			explanation: question.explanation,
			correctOptionIds: correctOptionIds(question),
			nextQuestionId: currentQuestionId(attempt),
			score: attemptScore(attempt),
		};
	}
}
