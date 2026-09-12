import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { type PageId, PagesService } from "@/modules/pages";
import { QuizSetEntity, type QuizSetId } from "..";
import { QuizSetNotFoundError } from "../quizzes.errors";
import { QuizzesRepository } from "../quizzes.repository";

export interface MoveQuizSetUseCaseOptions {
	readonly quizSetId: QuizSetId;
	readonly folderId?: PageId;
}

type Options = MoveQuizSetUseCaseOptions;
type Result = void;

@Injectable()
export class MoveQuizSetUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly quizzes: QuizzesRepository,
		private readonly pagesService: PagesService,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
	) {
		super();
	}

	async execute(options: MoveQuizSetUseCaseOptions): Promise<void> {
		await this.transaction.run(async () => {
			const stored = await this.quizzes.findById(options.quizSetId);

			if (stored === undefined) {
				throw new QuizSetNotFoundError(options.quizSetId);
			}

			if (options.folderId !== undefined) {
				await this.pagesService.require(options.folderId);
			}

			await this.quizzes.save(
				QuizSetEntity.moveToPage(stored, options.folderId, this.clock.now()),
			);
		});
	}
}
