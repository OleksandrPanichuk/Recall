import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import { type PageId, PagesService } from "@/modules/pages";
import { type QuizSetId, QuizSetNotFoundError } from "@/modules/quizzes";

export interface AttachQuizCommand {
	readonly folderId: PageId;
	readonly quizSetId: QuizSetId;
}

export interface AttachedQuiz {
	readonly folderId: PageId;
	readonly folderName: string;
	readonly quizSetId: QuizSetId;
	readonly title: string;
}

export type AttachQuizDependencies = ApplicationDependencies;

export class AttachQuizUseCase
	implements UseCase<Command<AttachQuizCommand>, AttachedQuiz>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;

	constructor(dependencies: AttachQuizDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
	}

	execute(request: Command<AttachQuizCommand>): Promise<AttachedQuiz> {
		return this.unitOfWork.run(async ({ pages, quizzes }) => {
			const page = await new PagesService(pages).require(request.folderId);
			const quiz = await quizzes.findById(request.quizSetId);

			if (quiz === undefined) {
				throw new QuizSetNotFoundError(request.quizSetId);
			}

			await pages.attachQuiz(page.id, quiz.id);

			return {
				folderId: page.id,
				folderName: page.name,
				quizSetId: quiz.id,
				title: quiz.title,
			};
		});
	}
}
