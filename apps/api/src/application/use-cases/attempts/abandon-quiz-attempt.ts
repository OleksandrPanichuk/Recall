import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import {
	type QuizAttemptId,
	QuizAttemptStatus,
} from "@/domain/quiz-attempt/quiz-attempt";

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

export interface AbandonQuizAttemptCommand {
	readonly attemptId?: QuizAttemptId;
}

export interface AbandonedAttempt {
	readonly abandoned: boolean;
}

export type AbandonQuizAttemptDependencies = ApplicationDependencies;

export class AbandonQuizAttemptUseCase
	implements UseCase<Command<AbandonQuizAttemptCommand>, AbandonedAttempt>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;

	constructor(dependencies: AbandonQuizAttemptDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
	}

	execute(
		request: Command<AbandonQuizAttemptCommand>,
	): Promise<AbandonedAttempt> {
		return this.unitOfWork.run(async ({ attempts }) => {
			const attempt =
				request.attemptId === undefined
					? await attempts.findActive()
					: await attempts.findById(request.attemptId);

			if (attempt === undefined) {
				return { abandoned: false };
			}

			if (attempt.status === QuizAttemptStatus.Completed) {
				throw new AttemptAlreadyFinishedError(attempt.id);
			}

			await attempts.delete(attempt.id);

			return { abandoned: true };
		});
	}
}
