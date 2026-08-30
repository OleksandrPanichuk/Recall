import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import {
	type QuizSetId,
	type QuizSetMetadata,
	updateQuizSetMetadata,
} from "@/domain/quiz-set/quiz-set";

export class QuizSetNotFoundError extends Error {
	readonly quizSetId: QuizSetId;

	constructor(quizSetId: QuizSetId) {
		super(`Quiz set ${quizSetId} does not exist`);
		this.name = "QuizSetNotFoundError";
		this.quizSetId = quizSetId;
	}
}

export interface UpdateQuizSetCommand extends QuizSetMetadata {
	readonly quizSetId: QuizSetId;
}

export type UpdateQuizSetDependencies = ApplicationDependencies;

export class UpdateQuizSetUseCase
	implements UseCase<Command<UpdateQuizSetCommand>, void>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;

	constructor(dependencies: UpdateQuizSetDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
	}

	async execute(request: Command<UpdateQuizSetCommand>): Promise<void> {
		await this.unitOfWork.run(async ({ quizzes }) => {
			const stored = await quizzes.findById(request.quizSetId);

			if (stored === undefined) {
				throw new QuizSetNotFoundError(request.quizSetId);
			}

			await quizzes.save(
				updateQuizSetMetadata(stored, request, this.clock.now()),
			);
		});
	}
}
