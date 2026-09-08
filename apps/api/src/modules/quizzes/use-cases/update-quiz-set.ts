import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { QuizSetEntity, type QuizSetId, type QuizSetMetadata } from "..";
import { QuizSetNotFoundError } from "../quizzes.errors";
import { QuizzesRepository } from "../quizzes.repository";

export interface UpdateQuizSetUseCaseOptions extends QuizSetMetadata {
	readonly quizSetId: QuizSetId;
}

type Options = UpdateQuizSetUseCaseOptions;
type Result = void;

@Injectable()
export class UpdateQuizSetUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly quizzes: QuizzesRepository,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
	) {
		super();
	}

	async execute(options: UpdateQuizSetUseCaseOptions): Promise<void> {
		await this.transaction.run(async () => {
			const stored = await this.quizzes.findById(options.quizSetId);

			if (stored === undefined) {
				throw new QuizSetNotFoundError(options.quizSetId);
			}

			await this.quizzes.save(
				QuizSetEntity.updateMetadata(stored, options, this.clock.now()),
			);
		});
	}
}
