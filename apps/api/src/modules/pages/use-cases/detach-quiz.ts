import { Injectable } from "@nestjs/common";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { type QuizSetId } from "@/modules/quizzes";
import type { PageId } from "../page.entity";
import { PagesRepository } from "../pages.repository";
import { PagesService } from "../pages.service";

export interface DetachQuizUseCaseOptions {
	readonly folderId: PageId;
	readonly quizSetId: QuizSetId;
}

export interface DetachedQuiz {
	readonly folderId: PageId;
	readonly folderName: string;
	readonly quizSetId: QuizSetId;
}

type Options = DetachQuizUseCaseOptions;
type Result = DetachedQuiz;

@Injectable()
export class DetachQuizUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly pages: PagesRepository,
		private readonly service: PagesService,
		private readonly transaction: Transaction,
	) {
		super();
	}

	execute({ folderId, quizSetId }: Options): Promise<Result> {
		return this.transaction.run(async () => {
			const page = await this.service.require(folderId);

			await this.pages.detachQuiz(page.id, quizSetId);

			return { folderId: page.id, folderName: page.name, quizSetId };
		});
	}
}
