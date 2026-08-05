import type { Clock } from "@/application/ports/clock";
import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { Command, UseCase } from "@/application/use-case";
import {
	attemptScore,
	completeQuizAttempt,
	type QuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { Score } from "@/domain/quiz-attempt/score";
import {
	type AttemptOfUserCommand,
	NoActiveAttemptError,
} from "./resume-quiz-attempt";

export interface FinishQuizAttemptResult {
	readonly attemptId: QuizAttemptId;
	readonly score: Score;
	readonly unansweredCount: number;
}

export interface FinishQuizAttemptDependencies {
	readonly attempts: QuizAttemptRepository;
	readonly clock: Clock;
}

export class FinishQuizAttempt
	implements UseCase<Command<AttemptOfUserCommand>, FinishQuizAttemptResult>
{
	private readonly attempts: QuizAttemptRepository;
	private readonly clock: Clock;

	constructor(dependencies: FinishQuizAttemptDependencies) {
		this.attempts = dependencies.attempts;
		this.clock = dependencies.clock;
	}

	async execute(
		request: Command<AttemptOfUserCommand>,
	): Promise<FinishQuizAttemptResult> {
		const attempt = this.attempts.findActiveByUser(request.telegramUserId);

		if (attempt === undefined) {
			throw new NoActiveAttemptError(request.telegramUserId);
		}

		const finished = completeQuizAttempt(attempt, this.clock.now());

		this.attempts.save(finished);

		return {
			attemptId: finished.id,
			// Unanswered questions still count against the score: attemptScore divides
			// by the plan length, not by how many were reached.
			unansweredCount: finished.questionIds.length - finished.responses.length,
			score: attemptScore(finished),
		};
	}
}
