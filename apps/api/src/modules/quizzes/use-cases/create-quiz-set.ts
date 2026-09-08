import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { IdGenerator } from "@/core/ports/id-generator";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { type PageId, PagesService } from "@/modules/pages";
import { QuizSetEntity, type QuizSetId, toQuizSetId } from "..";
import { QuizzesRepository } from "../quizzes.repository";

export interface CreateQuizSetUseCaseOptions {
	readonly title: string;
	readonly language: string;
	readonly description?: string;
	readonly source?: string;
	readonly sourceChapters?: string;
	readonly tags?: readonly string[];
	readonly folderId?: PageId;
}

export interface CreateQuizSetResult {
	readonly quizSetId: QuizSetId;
}

type Options = CreateQuizSetUseCaseOptions;
type Result = CreateQuizSetResult;

@Injectable()
export class CreateQuizSetUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly quizzes: QuizzesRepository,
		private readonly pagesService: PagesService,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
		private readonly ids: IdGenerator,
	) {
		super();
	}

	execute(options: CreateQuizSetUseCaseOptions): Promise<CreateQuizSetResult> {
		return this.transaction.run(async () => {
			if (options.folderId !== undefined) {
				await this.pagesService.require(options.folderId);
			}

			const quizSet = QuizSetEntity.create({
				id: toQuizSetId(this.ids.generate()),
				title: options.title,
				language: options.language,
				createdAt: this.clock.now(),
				description: options.description,
				source: options.source,
				sourceChapters: options.sourceChapters,
				tags: options.tags,
			});

			await this.quizzes.save(
				options.folderId === undefined
					? quizSet
					: QuizSetEntity.moveToPage(
							quizSet,
							options.folderId,
							quizSet.createdAt,
						),
			);

			return { quizSetId: quizSet.id };
		});
	}
}
