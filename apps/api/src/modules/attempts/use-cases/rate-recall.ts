import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { type QuestionId } from "@/modules/quizzes";
import { RecallGrade } from "@/modules/scheduling";
import { AttemptEntity } from "../attempt.entity";
import { AttemptsRepository } from "../attempts.repository";
import { NoActiveAttemptError } from "./resume-quiz-attempt";

export interface RateRecallUseCaseOptions {
	readonly questionId: QuestionId;
	readonly recall: RecallGrade;
}

@Injectable()
export class RateRecallUseCase extends UseCase<RateRecallUseCaseOptions, void> {
	constructor(
		private readonly attempts: AttemptsRepository,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
	) {
		super();
	}

	async execute(options: RateRecallUseCaseOptions): Promise<void> {
		await this.transaction.run(async () => {
			const attempt = await this.attempts.findActive();

			if (attempt === undefined) {
				throw new NoActiveAttemptError();
			}

			await this.attempts.save(
				AttemptEntity.rateResponse(
					attempt,
					options.questionId,
					options.recall,
					this.clock.now(),
				),
			);
		});
	}
}
