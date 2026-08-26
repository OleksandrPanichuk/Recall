import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import {
	currentQuestionId,
	pauseQuizAttempt,
	type QuizAttemptId,
	QuizAttemptStatus,
	resumeQuizAttempt,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { QuestionId } from "@/domain/quiz-set/question";

export class NoActiveAttemptError extends Error {
	constructor() {
		super("There is no unfinished attempt");
		this.name = "NoActiveAttemptError";
	}
}

// The owner comes from the scope, so asking about "the current attempt" needs no
// argument at all. A field here would be a caller naming a user again.
export type AttemptOfUserCommand = Readonly<Record<string, never>>;

export interface ResumeQuizAttemptResult {
	readonly attemptId: QuizAttemptId;
	readonly currentQuestionId?: QuestionId;
}

export type AttemptLifecycleDependencies = ApplicationDependencies;

export class PauseQuizAttemptUseCase
	implements UseCase<Command<AttemptOfUserCommand>, void>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;

	constructor(dependencies: AttemptLifecycleDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
	}

	async execute(_request: Command<AttemptOfUserCommand>): Promise<void> {
		await this.unitOfWork.run(async ({ attempts }) => {
			const attempt = await attempts.findActive();

			if (attempt === undefined) {
				throw new NoActiveAttemptError();
			}

			if (attempt.status === QuizAttemptStatus.Paused) {
				return;
			}

			await attempts.save(pauseQuizAttempt(attempt, this.clock.now()));
		});
	}
}

export class ResumeQuizAttemptUseCase
	implements UseCase<Command<AttemptOfUserCommand>, ResumeQuizAttemptResult>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;

	constructor(dependencies: AttemptLifecycleDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
	}

	execute(
		_request: Command<AttemptOfUserCommand>,
	): Promise<ResumeQuizAttemptResult> {
		return this.unitOfWork.run(async ({ attempts }) => {
			const attempt = await attempts.findActive();

			if (attempt === undefined) {
				throw new NoActiveAttemptError();
			}

			if (attempt.status === QuizAttemptStatus.Active) {
				return {
					attemptId: attempt.id,
					currentQuestionId: currentQuestionId(attempt),
				};
			}

			const resumed = resumeQuizAttempt(attempt, this.clock.now());

			await attempts.save(resumed);

			return {
				attemptId: resumed.id,
				currentQuestionId: currentQuestionId(resumed),
			};
		});
	}
}
