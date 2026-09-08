import { Inject, Injectable } from "@nestjs/common";
import type { AttemptRepository } from "@/application/ports/repositories/attempt.repository";
import { Clock } from "@/core/ports/clock";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import { type QuestionId, QuizSetEntity, type QuizSetId } from "..";
import {
	AnsweredQuestionError,
	QuestionNotFoundError,
	QuizSetNotFoundError,
} from "../quizzes.errors";
import { QuizzesRepository } from "../quizzes.repository";
import { ATTEMPTS } from "../quizzes.tokens";

export interface DeleteQuestionUseCaseOptions {
	readonly quizSetId: QuizSetId;
	readonly questionId: QuestionId;
}

export interface DeleteQuestionResult {
	readonly questionId: QuestionId;
	readonly remaining: number;
}

type Options = DeleteQuestionUseCaseOptions;
type Result = DeleteQuestionResult;

@Injectable()
export class DeleteQuestionUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly quizzes: QuizzesRepository,
		@Inject(ATTEMPTS) private readonly attempts: AttemptRepository,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
	) {
		super();
	}

	async execute(
		options: DeleteQuestionUseCaseOptions,
	): Promise<DeleteQuestionResult> {
		return this.transaction.run(async () => {
			const quizSet = await this.quizzes.findById(options.quizSetId);

			if (quizSet === undefined) {
				throw new QuizSetNotFoundError(options.quizSetId);
			}

			const current = quizSet.questions.find(
				(question) => String(question.id) === String(options.questionId),
			);

			if (current === undefined) {
				throw new QuestionNotFoundError(options.quizSetId, options.questionId);
			}

			const answers = await this.attempts.answerCount(current.id);

			if (answers > 0) {
				throw new AnsweredQuestionError(current.id, answers);
			}

			const updated = QuizSetEntity.replaceQuestions(
				quizSet,
				[],
				[current.id],
				this.clock.now(),
			);

			await this.quizzes.save(updated);

			return { questionId: current.id, remaining: updated.questions.length };
		});
	}
}
