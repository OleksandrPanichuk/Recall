import type { Clock } from "@/application/ports/clock";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Command, UseCase } from "@/application/use-case";
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

export interface UpdateQuizSetDependencies {
	readonly quizSets: QuizSetRepository;
	readonly clock: Clock;
}

export class UpdateQuizSetUseCase
	implements UseCase<Command<UpdateQuizSetCommand>, void>
{
	private readonly quizSets: QuizSetRepository;
	private readonly clock: Clock;

	constructor(dependencies: UpdateQuizSetDependencies) {
		this.quizSets = dependencies.quizSets;
		this.clock = dependencies.clock;
	}

	async execute(request: Command<UpdateQuizSetCommand>): Promise<void> {
		const stored = this.quizSets.findById(request.quizSetId);

		if (stored === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		this.quizSets.save(
			updateQuizSetMetadata(stored, request, this.clock.now()),
		);
	}
}
