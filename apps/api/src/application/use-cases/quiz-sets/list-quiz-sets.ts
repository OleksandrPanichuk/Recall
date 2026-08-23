import type {
	QuizSetRepository,
	QuizSetSummary,
} from "@/application/ports/repositories/quiz-set.repository";
import type { Command, UseCase } from "@/application/use-case";
import { QuizSetStatus } from "@/domain/quiz-set/quiz-set";

export interface ListQuizSetsCommand {
	readonly includeUnpublished?: boolean;
}

export interface ListQuizSetsDependencies {
	readonly quizSets: QuizSetRepository;
}

export class ListQuizSets
	implements UseCase<Command<ListQuizSetsCommand>, readonly QuizSetSummary[]>
{
	private readonly quizSets: QuizSetRepository;

	constructor(dependencies: ListQuizSetsDependencies) {
		this.quizSets = dependencies.quizSets;
	}

	async execute(
		request: Command<ListQuizSetsCommand>,
	): Promise<readonly QuizSetSummary[]> {
		return this.quizSets.list(
			request.includeUnpublished === true
				? undefined
				: { statuses: [QuizSetStatus.Published] },
		);
	}
}
