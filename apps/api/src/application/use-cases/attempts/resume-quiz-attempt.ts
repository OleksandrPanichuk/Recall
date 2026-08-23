import type { Clock } from "@/application/ports/clock";
import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { Command, UseCase } from "@/application/use-case";
import {
	currentQuestionId,
	pauseQuizAttempt,
	type QuizAttemptId,
	QuizAttemptStatus,
	resumeQuizAttempt,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { QuestionId } from "@/domain/quiz-set/question";

export class NoActiveAttemptError extends Error {
	constructor(telegramUserId: number) {
		super(`User ${telegramUserId} has no unfinished attempt`);
		this.name = "NoActiveAttemptError";
	}
}

export interface AttemptOfUserCommand {
	readonly telegramUserId: number;
}

export interface ResumeQuizAttemptResult {
	readonly attemptId: QuizAttemptId;
	readonly currentQuestionId?: QuestionId;
}

export interface AttemptLifecycleDependencies {
	readonly attempts: QuizAttemptRepository;
	readonly clock: Clock;
}

export class PauseQuizAttempt
	implements UseCase<Command<AttemptOfUserCommand>, void>
{
	private readonly attempts: QuizAttemptRepository;
	private readonly clock: Clock;

	constructor(dependencies: AttemptLifecycleDependencies) {
		this.attempts = dependencies.attempts;
		this.clock = dependencies.clock;
	}

	async execute(request: Command<AttemptOfUserCommand>): Promise<void> {
		const attempt = this.attempts.findActiveByUser(request.telegramUserId);

		if (attempt === undefined) {
			throw new NoActiveAttemptError(request.telegramUserId);
		}

		if (attempt.status === QuizAttemptStatus.Paused) {
			return;
		}

		this.attempts.save(pauseQuizAttempt(attempt, this.clock.now()));
	}
}

export class ResumeQuizAttempt
	implements UseCase<Command<AttemptOfUserCommand>, ResumeQuizAttemptResult>
{
	private readonly attempts: QuizAttemptRepository;
	private readonly clock: Clock;

	constructor(dependencies: AttemptLifecycleDependencies) {
		this.attempts = dependencies.attempts;
		this.clock = dependencies.clock;
	}

	async execute(
		request: Command<AttemptOfUserCommand>,
	): Promise<ResumeQuizAttemptResult> {
		const attempt = this.attempts.findActiveByUser(request.telegramUserId);

		if (attempt === undefined) {
			throw new NoActiveAttemptError(request.telegramUserId);
		}

		if (attempt.status === QuizAttemptStatus.Active) {
			return {
				attemptId: attempt.id,
				currentQuestionId: currentQuestionId(attempt),
			};
		}

		const resumed = resumeQuizAttempt(attempt, this.clock.now());

		this.attempts.save(resumed);

		return {
			attemptId: resumed.id,
			currentQuestionId: currentQuestionId(resumed),
		};
	}
}
