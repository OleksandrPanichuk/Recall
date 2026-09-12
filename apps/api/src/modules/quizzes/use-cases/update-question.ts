import { Injectable } from "@nestjs/common";
import { Clock } from "@/core/ports/clock";
import { IdGenerator } from "@/core/ports/id-generator";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import {
	createQuestion,
	Difficulty,
	QuestionEntity,
	type QuestionId,
	QuizSetEntity,
	type QuizSetId,
	toQuestionOptionId,
} from "..";
import { QuestionNotFoundError, QuizSetNotFoundError } from "../quizzes.errors";
import { QuizzesRepository } from "../quizzes.repository";
import type { QuestionOptionInput } from "./add-questions";

export interface UpdateQuestionUseCaseOptions {
	readonly quizSetId: QuizSetId;
	readonly questionId: QuestionId;
	readonly prompt?: string;
	readonly difficulty?: Difficulty;
	readonly explanation?: string;
	readonly sourceReference?: string;
	readonly topic?: string;
	readonly hint?: string;
	readonly options?: readonly QuestionOptionInput[];
}

export interface UpdateQuestionResult {
	readonly questionId: QuestionId;
	readonly prompt: string;
	readonly optionCount: number;
}

type Options = UpdateQuestionUseCaseOptions;
type Result = UpdateQuestionResult;

@Injectable()
export class UpdateQuestionUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly quizzes: QuizzesRepository,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
		private readonly ids: IdGenerator,
	) {
		super();
	}

	async execute(
		options: UpdateQuestionUseCaseOptions,
	): Promise<UpdateQuestionResult> {
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

			const replacement = this.rebuilt(current, options);
			const updated = QuizSetEntity.replaceQuestions(
				quizSet,
				[replacement],
				[],
				this.clock.now(),
			);

			await this.quizzes.save(updated);

			return {
				questionId: replacement.id,
				prompt: replacement.prompt,
				optionCount: replacement.options.length,
			};
		});
	}

	private rebuilt(
		current: QuestionEntity,
		wanted: UpdateQuestionUseCaseOptions,
	): QuestionEntity {
		const options =
			wanted.options === undefined
				? current.options
				: wanted.options.map((option, index) => ({
						id:
							current.options[index]?.id ??
							toQuestionOptionId(this.ids.generate()),
						text: option.text,
						isCorrect: option.isCorrect,
						position: index,
						matchKey: option.matchKey,
					}));

		return createQuestion({
			id: current.id,
			type: current.type,
			prompt: wanted.prompt ?? current.prompt,
			difficulty: wanted.difficulty ?? current.difficulty,
			position: current.position,
			options,
			explanation: wanted.explanation ?? current.explanation,
			sourceReference: wanted.sourceReference ?? current.sourceReference,
			topic: wanted.topic ?? current.topic,
			hint: wanted.hint ?? current.hint,
			vocabularyItemId: current.vocabularyItemId,
		});
	}
}
