import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import {
	publishQuizSet,
	type QuizSetId,
	QuizSetStatus,
} from "@/domain/quiz-set/quiz-set";
import { QuizSetNotFoundError } from "./update-quiz-set";

export interface PublishQuizSetCommand {
	readonly quizSetId: QuizSetId;
}

export type PublishQuizSetDependencies = ApplicationDependencies;

export class PublishQuizSetUseCase
	implements UseCase<Command<PublishQuizSetCommand>, void>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;

	constructor(dependencies: PublishQuizSetDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
	}

	async execute(request: Command<PublishQuizSetCommand>): Promise<void> {
		await this.unitOfWork.run(async ({ quizzes }) => {
			const stored = await quizzes.findById(request.quizSetId);

			if (stored === undefined) {
				throw new QuizSetNotFoundError(request.quizSetId);
			}

			if (stored.status === QuizSetStatus.Published) {
				return;
			}

			await quizzes.save(publishQuizSet(stored, this.clock.now()));
		});
	}
}
