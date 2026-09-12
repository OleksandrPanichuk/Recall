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
	QuestionType,
	QuizSetEntity,
	type QuizSetId,
	questionFingerprint,
	toQuestionId,
	toQuestionOptionId,
} from "..";
import { MAX_QUESTIONS_PER_BATCH } from "../quiz-set.constants";
import {
	EmptyQuestionBatchError,
	QuestionBatchTooLargeError,
	QuizSetNotFoundError,
} from "../quizzes.errors";

import { QuizzesRepository } from "../quizzes.repository";

export interface QuestionOptionInput {
	readonly text: string;
	readonly isCorrect: boolean;
	readonly matchKey?: string;
}

export interface QuestionInput {
	readonly type: QuestionType;
	readonly prompt: string;
	readonly difficulty: Difficulty;
	readonly options: readonly QuestionOptionInput[];
	readonly explanation?: string;
	readonly sourceReference?: string;
	readonly topic?: string;
	readonly hint?: string;
	readonly vocabularyItemId?: string;
}

export interface AddQuestionsUseCaseOptions {
	readonly quizSetId: QuizSetId;
	readonly questions: readonly QuestionInput[];
}

export interface AddQuestionsResult {
	readonly addedQuestionIds: readonly QuestionId[];
	readonly alreadyPresent: boolean;
}

type Options = AddQuestionsUseCaseOptions;
type Result = AddQuestionsResult;

@Injectable()
export class AddQuestionsUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly quizzes: QuizzesRepository,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
		private readonly ids: IdGenerator,
	) {
		super();
	}

	async execute(
		options: AddQuestionsUseCaseOptions,
	): Promise<AddQuestionsResult> {
		if (options.questions.length === 0) {
			throw new EmptyQuestionBatchError();
		}

		if (options.questions.length > MAX_QUESTIONS_PER_BATCH) {
			throw new QuestionBatchTooLargeError(
				options.questions.length,
				MAX_QUESTIONS_PER_BATCH,
			);
		}

		const at = this.clock.now();

		return this.transaction.run(async () => {
			const stored = await this.quizzes.findById(options.quizSetId);

			if (stored === undefined) {
				throw new QuizSetNotFoundError(options.quizSetId);
			}

			const questions = options.questions.map((input, index) =>
				this.toQuestion(input, stored.questions.length + index),
			);
			const present = new Set(stored.questions.map(questionFingerprint));

			if (
				questions.every((question) =>
					present.has(questionFingerprint(question)),
				)
			) {
				return { addedQuestionIds: [], alreadyPresent: true };
			}

			await this.quizzes.save(
				QuizSetEntity.addQuestions(stored, questions, at),
			);

			return {
				addedQuestionIds: questions.map((question) => question.id),
				alreadyPresent: false,
			};
		});
	}

	private toQuestion(input: QuestionInput, position: number): QuestionEntity {
		return createQuestion({
			id: toQuestionId(this.ids.generate()),
			type: input.type,
			prompt: input.prompt,
			difficulty: input.difficulty,
			position,
			options: input.options.map((option, index) => ({
				id: toQuestionOptionId(this.ids.generate()),
				text: option.text,
				isCorrect: option.isCorrect,
				position: index,
				matchKey: option.matchKey,
			})),
			explanation: input.explanation,
			sourceReference: input.sourceReference,
			topic: input.topic,
			hint: input.hint,
			vocabularyItemId: input.vocabularyItemId,
		});
	}
}
