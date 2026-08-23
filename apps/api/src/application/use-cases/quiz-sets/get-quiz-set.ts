import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import type { QuizSet, QuizSetId } from "@/domain/quiz-set/quiz-set";
import { QuizSetNotFoundError } from "./update-quiz-set";

export interface GetQuizSetCommand {
	readonly quizSetId: QuizSetId;
}

export type GetQuizSetDependencies = ApplicationDependencies;

export class GetQuizSetUseCase
	implements UseCase<Command<GetQuizSetCommand>, QuizSet>
{
	private readonly scope: RepositoryScope;

	constructor(dependencies: GetQuizSetDependencies) {
		this.scope = dependencies.scope;
	}

	async execute(request: Command<GetQuizSetCommand>): Promise<QuizSet> {
		const stored = await this.scope.quizzes.findById(request.quizSetId);

		if (stored === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		return stored;
	}
}
