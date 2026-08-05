import type { Clock } from "@/application/ports/clock";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Command, UseCase } from "@/application/use-case";
import {
	publishQuizSet,
	type QuizSetId,
	QuizSetStatus,
} from "@/domain/quiz-set/quiz-set";
import { QuizSetNotFoundError } from "./update-quiz-set";

export interface PublishQuizSetCommand {
	readonly quizSetId: QuizSetId;
}

export interface PublishQuizSetDependencies {
	readonly quizSets: QuizSetRepository;
	readonly clock: Clock;
}

export class PublishQuizSet
	implements UseCase<Command<PublishQuizSetCommand>, void>
{
	private readonly quizSets: QuizSetRepository;
	private readonly clock: Clock;

	constructor(dependencies: PublishQuizSetDependencies) {
		this.quizSets = dependencies.quizSets;
		this.clock = dependencies.clock;
	}

	async execute(request: Command<PublishQuizSetCommand>): Promise<void> {
		const stored = this.quizSets.findById(request.quizSetId);

		if (stored === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		// Publishing twice is a retry, not an error: keep the original publishedAt.
		if (stored.status === QuizSetStatus.Published) {
			return;
		}

		this.quizSets.save(publishQuizSet(stored, this.clock.now()));
	}
}
