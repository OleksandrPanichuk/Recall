import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import type { FolderId } from "@/domain/folder/folder";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { requireFolder } from "./create-folder";

export interface DetachQuizCommand {
	readonly folderId: FolderId;
	readonly quizSetId: QuizSetId;
}

export interface DetachedQuiz {
	readonly folderId: FolderId;
	readonly folderName: string;
	readonly quizSetId: QuizSetId;
}

export type DetachQuizDependencies = ApplicationDependencies;

export class DetachQuizUseCase
	implements UseCase<Command<DetachQuizCommand>, DetachedQuiz>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;

	constructor(dependencies: DetachQuizDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
	}

	execute(request: Command<DetachQuizCommand>): Promise<DetachedQuiz> {
		return this.unitOfWork.run(async ({ pages }) => {
			const page = await requireFolder(pages, request.folderId);

			await pages.detachQuiz(page.id, request.quizSetId);

			return {
				folderId: page.id,
				folderName: page.name,
				quizSetId: request.quizSetId,
			};
		});
	}
}
