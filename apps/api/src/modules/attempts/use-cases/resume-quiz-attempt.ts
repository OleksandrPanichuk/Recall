import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { type QuestionId } from "@/modules/quizzes";
import { AttemptEntity } from "../attempt.entity";
import { type QuizAttemptId } from "../attempt.entity.types";
import { QuizAttemptStatus } from "../attempts.constants";
import { AttemptsRepository } from "../attempts.repository";

export class NoActiveAttemptError extends Error {
	constructor() {
		super("There is no unfinished attempt");
		this.name = "NoActiveAttemptError";
	}
}

export type AttemptOfUserCommand = Readonly<Record<string, never>>;

export type PauseQuizAttemptUseCaseOptions = AttemptOfUserCommand;
export type ResumeQuizAttemptUseCaseOptions = AttemptOfUserCommand;

export interface ResumeQuizAttemptResult {
	readonly attemptId: QuizAttemptId;
	readonly currentQuestionId?: QuestionId;
}

@Injectable()
export class PauseQuizAttemptUseCase extends UseCase<
	PauseQuizAttemptUseCaseOptions,
	void
> {
	constructor(
		private readonly attempts: AttemptsRepository,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
	) {
		super();
	}

	async execute(_options: PauseQuizAttemptUseCaseOptions): Promise<void> {
		await this.transaction.run(async () => {
			const attempt = await this.attempts.findActive();

			if (attempt === undefined) {
				throw new NoActiveAttemptError();
			}

			if (attempt.status === QuizAttemptStatus.Paused) {
				return;
			}

			await this.attempts.save(AttemptEntity.pause(attempt, this.clock.now()));
		});
	}
}

@Injectable()
export class ResumeQuizAttemptUseCase extends UseCase<
	ResumeQuizAttemptUseCaseOptions,
	ResumeQuizAttemptResult
> {
	constructor(
		private readonly attempts: AttemptsRepository,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
	) {
		super();
	}

	execute(
		_options: ResumeQuizAttemptUseCaseOptions,
	): Promise<ResumeQuizAttemptResult> {
		return this.transaction.run(async () => {
			const attempt = await this.attempts.findActive();

			if (attempt === undefined) {
				throw new NoActiveAttemptError();
			}

			if (attempt.status === QuizAttemptStatus.Active) {
				return {
					attemptId: attempt.id,
					currentQuestionId: AttemptEntity.currentQuestionId(attempt),
				};
			}

			const resumed = AttemptEntity.resume(attempt, this.clock.now());

			await this.attempts.save(resumed);

			return {
				attemptId: resumed.id,
				currentQuestionId: AttemptEntity.currentQuestionId(resumed),
			};
		});
	}
}
