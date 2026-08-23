import type { Clock } from "@/application/ports/clock";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Command, UseCase } from "@/application/use-case";
import {
	archiveQuizSet,
	type QuizSetId,
	QuizSetStatus,
} from "@/domain/quiz-set/quiz-set";
import { QuizSetNotFoundError } from "./update-quiz-set";

export interface ArchiveQuizSetCommand {
	readonly quizSetId: QuizSetId;
}

export interface ArchiveQuizSetDependencies {
	readonly quizSets: QuizSetRepository;
	readonly clock: Clock;
}

export class ArchiveQuizSetUseCase
	implements UseCase<Command<ArchiveQuizSetCommand>, void>
{
	private readonly quizSets: QuizSetRepository;
	private readonly clock: Clock;

	constructor(dependencies: ArchiveQuizSetDependencies) {
		this.quizSets = dependencies.quizSets;
		this.clock = dependencies.clock;
	}

	async execute(request: Command<ArchiveQuizSetCommand>): Promise<void> {
		const stored = this.quizSets.findById(request.quizSetId);

		if (stored === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		if (stored.status === QuizSetStatus.Archived) {
			return;
		}

		this.quizSets.save(archiveQuizSet(stored, this.clock.now()));
	}
}
