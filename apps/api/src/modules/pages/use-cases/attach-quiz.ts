import { Injectable } from "@nestjs/common";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { QuizSetNotFoundError } from "@/modules/quizzes";
import type { PageId } from "../page.entity";
import type { LinkedQuizId } from "../page.quiz-link";
import { PagesRepository } from "../pages.repository";
import { PagesService } from "../pages.service";

export interface AttachQuizUseCaseOptions {
	readonly folderId: PageId;
	readonly quizSetId: LinkedQuizId;
}

export interface AttachedQuiz {
	readonly folderId: PageId;
	readonly folderName: string;
	readonly quizSetId: LinkedQuizId;
	readonly title: string;
}

type Options = AttachQuizUseCaseOptions;

@Injectable()
export class AttachQuizUseCase extends UseCase<Options, AttachedQuiz> {
	constructor(
		private readonly pages: PagesRepository,
		private readonly pagesService: PagesService,
		private readonly transaction: Transaction,
	) {
		super();
	}

	execute(options: Options): Promise<AttachedQuiz> {
		return this.transaction.run(async () => {
			const page = await this.pagesService.require(options.folderId);
			const quiz = await this.pages.findLinkedQuiz(options.quizSetId);

			if (quiz === undefined) {
				throw new QuizSetNotFoundError(options.quizSetId);
			}

			await this.pages.attachQuiz(page.id, quiz.id);

			return {
				folderId: page.id,
				folderName: page.name,
				quizSetId: quiz.id,
				title: quiz.title,
			};
		});
	}
}
