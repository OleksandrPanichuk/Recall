import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import {
	archiveQuizSet,
	type QuizSetId,
	QuizSetStatus,
} from "@/domain/quiz-set/quiz-set";
import { QuizSetNotFoundError } from "./update-quiz-set";

export interface ArchiveQuizSetCommand {
	readonly quizSetId: QuizSetId;
}

export type ArchiveQuizSetDependencies = ApplicationDependencies;

export class ArchiveQuizSetUseCase
	implements UseCase<Command<ArchiveQuizSetCommand>, void>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;

	constructor(dependencies: ArchiveQuizSetDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
	}

	async execute(request: Command<ArchiveQuizSetCommand>): Promise<void> {
		await this.unitOfWork.run(async ({ quizzes }) => {
			const stored = await quizzes.findById(request.quizSetId);

			if (stored === undefined) {
				throw new QuizSetNotFoundError(request.quizSetId);
			}

			if (stored.status === QuizSetStatus.Archived) {
				return;
			}

			await quizzes.save(archiveQuizSet(stored, this.clock.now()));
		});
	}
}
