import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { QuizSummary } from "@/application/ports/repositories/quiz.repository";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import { QuizSetStatus } from "@/domain/quiz-set/quiz-set";

export interface ListQuizSetsCommand {
	readonly includeUnpublished?: boolean;
}

export type ListQuizSetsDependencies = ApplicationDependencies;

export class ListQuizSetsUseCase
	implements UseCase<Command<ListQuizSetsCommand>, readonly QuizSummary[]>
{
	private readonly scope: RepositoryScope;

	constructor(dependencies: ListQuizSetsDependencies) {
		this.scope = dependencies.scope;
	}

	async execute(
		request: Command<ListQuizSetsCommand>,
	): Promise<readonly QuizSummary[]> {
		return this.scope.quizzes.list(
			request.includeUnpublished === true
				? undefined
				: { statuses: [QuizSetStatus.Published] },
		);
	}
}
