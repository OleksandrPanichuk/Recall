import { Injectable } from "@nestjs/common";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { type QuizAttemptId } from "../attempt.entity.types";
import { QuizAttemptStatus } from "../attempts.constants";
import { AttemptsRepository } from "../attempts.repository";

export class AttemptAlreadyFinishedError extends Error {
	readonly attemptId: QuizAttemptId;

	constructor(attemptId: QuizAttemptId) {
		super(
			`Attempt ${attemptId} is already finished, so it cannot be abandoned`,
		);
		this.name = "AttemptAlreadyFinishedError";
		this.attemptId = attemptId;
	}
}

export interface AbandonQuizAttemptUseCaseOptions {
	readonly attemptId?: QuizAttemptId;
}

export interface AbandonedAttempt {
	readonly abandoned: boolean;
}

@Injectable()
export class AbandonQuizAttemptUseCase extends UseCase<
	AbandonQuizAttemptUseCaseOptions,
	AbandonedAttempt
> {
	constructor(
		private readonly attempts: AttemptsRepository,
		private readonly transaction: Transaction,
	) {
		super();
	}

	execute(
		options: AbandonQuizAttemptUseCaseOptions,
	): Promise<AbandonedAttempt> {
		return this.transaction.run(async () => {
			const attempt =
				options.attemptId === undefined
					? await this.attempts.findActive()
					: await this.attempts.findById(options.attemptId);

			if (attempt === undefined) {
				return { abandoned: false };
			}

			if (attempt.status === QuizAttemptStatus.Completed) {
				throw new AttemptAlreadyFinishedError(attempt.id);
			}

			await this.attempts.delete(attempt.id);

			return { abandoned: true };
		});
	}
}
