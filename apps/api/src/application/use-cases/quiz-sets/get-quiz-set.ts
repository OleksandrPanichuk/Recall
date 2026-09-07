import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import { QuizSetEntity, type QuizSetId } from "@/modules/quizzes";
import { QuizSetNotFoundError } from "./update-quiz-set";

export interface GetQuizSetCommand {
	readonly quizSetId: QuizSetId;
}

export type GetQuizSetDependencies = ApplicationDependencies;

export class GetQuizSetUseCase
	implements UseCase<Command<GetQuizSetCommand>, QuizSetEntity>
{
	private readonly scope: RepositoryScope;

	constructor(dependencies: GetQuizSetDependencies) {
		this.scope = dependencies.scope;
	}

	async execute(request: Command<GetQuizSetCommand>): Promise<QuizSetEntity> {
		const stored = await this.scope.quizzes.findById(request.quizSetId);

		if (stored === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		return stored;
	}
}
