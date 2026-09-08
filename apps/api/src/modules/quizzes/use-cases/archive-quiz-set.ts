import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { QuizSetEntity, type QuizSetId, QuizSetStatus } from "..";
import { QuizSetNotFoundError } from "../quizzes.errors";
import { QuizzesRepository } from "../quizzes.repository";

export interface ArchiveQuizSetUseCaseOptions {
	readonly quizSetId: QuizSetId;
}

type Options = ArchiveQuizSetUseCaseOptions;
type Result = void;

@Injectable()
export class ArchiveQuizSetUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly quizzes: QuizzesRepository,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
	) {
		super();
	}

	async execute(options: ArchiveQuizSetUseCaseOptions): Promise<void> {
		await this.transaction.run(async () => {
			const stored = await this.quizzes.findById(options.quizSetId);

			if (stored === undefined) {
				throw new QuizSetNotFoundError(options.quizSetId);
			}

			if (stored.status === QuizSetStatus.Archived) {
				return;
			}

			await this.quizzes.save(QuizSetEntity.archive(stored, this.clock.now()));
		});
	}
}
