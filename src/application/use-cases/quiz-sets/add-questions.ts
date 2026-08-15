import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { Command, UseCase } from "@/application/use-case";
import { createQuestion } from "@/domain/quiz-set/create-question";
import {
	type Difficulty,
	type Question,
	type QuestionId,
	type QuestionType,
	toQuestionId,
	toQuestionOptionId,
} from "@/domain/quiz-set/question";
import { questionFingerprint } from "@/domain/quiz-set/question-fingerprint";
import { addQuestions, type QuizSetId } from "@/domain/quiz-set/quiz-set";
import { QuizSetNotFoundError } from "./update-quiz-set";

export const MAX_QUESTIONS_PER_BATCH = 50;

export class EmptyQuestionBatchError extends Error {
	constructor() {
		super("A question batch must contain at least one question");
		this.name = "EmptyQuestionBatchError";
	}
}

export class QuestionBatchTooLargeError extends Error {
	constructor(size: number, limit: number) {
		super(`A question batch of ${size} exceeds the limit of ${limit}`);
		this.name = "QuestionBatchTooLargeError";
	}
}

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
}

export interface AddQuestionsCommand {
	readonly quizSetId: QuizSetId;
	readonly questions: readonly QuestionInput[];
}

export interface AddQuestionsResult {
	readonly addedQuestionIds: readonly QuestionId[];
	readonly alreadyPresent: boolean;
}

export interface AddQuestionsDependencies {
	readonly quizSets: QuizSetRepository;
	readonly clock: Clock;
	readonly idGenerator: IdGenerator;
	readonly transaction: Transaction;
}

export class AddQuestions
	implements UseCase<Command<AddQuestionsCommand>, AddQuestionsResult>
{
	private readonly quizSets: QuizSetRepository;
	private readonly clock: Clock;
	private readonly idGenerator: IdGenerator;
	private readonly transaction: Transaction;

	constructor(dependencies: AddQuestionsDependencies) {
		this.quizSets = dependencies.quizSets;
		this.clock = dependencies.clock;
		this.idGenerator = dependencies.idGenerator;
		this.transaction = dependencies.transaction;
	}

	async execute(
		request: Command<AddQuestionsCommand>,
	): Promise<AddQuestionsResult> {
		if (request.questions.length === 0) {
			throw new EmptyQuestionBatchError();
		}

		if (request.questions.length > MAX_QUESTIONS_PER_BATCH) {
			throw new QuestionBatchTooLargeError(
				request.questions.length,
				MAX_QUESTIONS_PER_BATCH,
			);
		}

		const at = this.clock.now();

		return this.transaction.run(() => {
			const stored = this.quizSets.findById(request.quizSetId);

			if (stored === undefined) {
				throw new QuizSetNotFoundError(request.quizSetId);
			}

			const questions = request.questions.map((input, index) =>
				this.toQuestion(input, stored.questions.length + index),
			);
			const present = new Set(stored.questions.map(questionFingerprint));

			// A retried batch has identical content but fresh ids, and fingerprints
			// ignore ids, so a fully-present batch is a replay rather than an error.
			if (
				questions.every((question) =>
					present.has(questionFingerprint(question)),
				)
			) {
				return { addedQuestionIds: [], alreadyPresent: true };
			}

			this.quizSets.save(addQuestions(stored, questions, at));

			return {
				addedQuestionIds: questions.map((question) => question.id),
				alreadyPresent: false,
			};
		});
	}

	private toQuestion(input: QuestionInput, position: number): Question {
		return createQuestion({
			id: toQuestionId(this.idGenerator.generate()),
			type: input.type,
			prompt: input.prompt,
			difficulty: input.difficulty,
			position,
			options: input.options.map((option, index) => ({
				id: toQuestionOptionId(this.idGenerator.generate()),
				text: option.text,
				isCorrect: option.isCorrect,
				position: index,
				matchKey: option.matchKey,
			})),
			explanation: input.explanation,
			sourceReference: input.sourceReference,
			topic: input.topic,
			hint: input.hint,
		});
	}
}
