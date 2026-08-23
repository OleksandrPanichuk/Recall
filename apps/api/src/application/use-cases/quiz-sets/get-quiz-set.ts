import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { QuizSet, QuizSetId } from "@/domain/quiz-set/quiz-set";
import { QuizSetNotFoundError } from "./update-quiz-set";

export interface GetQuizSetCommand {
	readonly quizSetId: QuizSetId;
}

export interface GetQuizSetDependencies {
	readonly quizSets: QuizSetRepository;
}

export class GetQuizSetUseCase
	implements UseCase<Command<GetQuizSetCommand>, QuizSet>
{
	private readonly quizSets: QuizSetRepository;

	constructor(dependencies: GetQuizSetDependencies) {
		this.quizSets = dependencies.quizSets;
	}

	async execute(request: Command<GetQuizSetCommand>): Promise<QuizSet> {
		const stored = this.quizSets.findById(request.quizSetId);

		if (stored === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		return stored;
	}
}
