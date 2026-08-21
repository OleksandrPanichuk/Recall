import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Command, UseCase } from "@/application/use-case";
import { createQuestion } from "@/domain/quiz-set/create-question";
import type { Difficulty } from "@/domain/quiz-set/question";
import {
	type Question,
	type QuestionId,
	toQuestionOptionId,
} from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { replaceQuestions } from "@/domain/quiz-set/quiz-set";
import type { QuestionOptionInput } from "./add-questions";
import { QuizSetNotFoundError } from "./update-quiz-set";

export class QuestionNotFoundError extends Error {
	readonly quizSetId: QuizSetId;
	readonly questionId: QuestionId;

	constructor(quizSetId: QuizSetId, questionId: QuestionId) {
		super(`Quiz set ${quizSetId} has no question ${questionId}`);
		this.name = "QuestionNotFoundError";
		this.quizSetId = quizSetId;
		this.questionId = questionId;
	}
}

export interface UpdateQuestionCommand {
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

export interface UpdateQuestionDependencies {
	readonly quizSets: QuizSetRepository;
	readonly clock: Clock;
	readonly idGenerator: IdGenerator;
}

export class UpdateQuestion
	implements UseCase<Command<UpdateQuestionCommand>, UpdateQuestionResult>
{
	private readonly quizSets: QuizSetRepository;
	private readonly clock: Clock;
	private readonly idGenerator: IdGenerator;

	constructor(dependencies: UpdateQuestionDependencies) {
		this.quizSets = dependencies.quizSets;
		this.clock = dependencies.clock;
		this.idGenerator = dependencies.idGenerator;
	}

	async execute(
		request: Command<UpdateQuestionCommand>,
	): Promise<UpdateQuestionResult> {
		const quizSet = this.quizSets.findById(request.quizSetId);

		if (quizSet === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		const current = quizSet.questions.find(
			(question) => String(question.id) === String(request.questionId),
		);

		if (current === undefined) {
			throw new QuestionNotFoundError(request.quizSetId, request.questionId);
		}

		const replacement = this.rebuilt(current, request);
		const updated = replaceQuestions(
			quizSet,
			[replacement],
			[],
			this.clock.now(),
		);

		this.quizSets.save(updated);

		return {
			questionId: replacement.id,
			prompt: replacement.prompt,
			optionCount: replacement.options.length,
		};
	}

	private rebuilt(
		current: Question,
		request: Command<UpdateQuestionCommand>,
	): Question {
		const options =
			request.options === undefined
				? current.options
				: request.options.map((option, index) => ({
						id: toQuestionOptionId(this.idGenerator.generate()),
						text: option.text,
						isCorrect: option.isCorrect,
						position: index,
						matchKey: option.matchKey,
					}));

		return createQuestion({
			id: current.id,
			type: current.type,
			prompt: request.prompt ?? current.prompt,
			difficulty: request.difficulty ?? current.difficulty,
			position: current.position,
			options,
			explanation: request.explanation ?? current.explanation,
			sourceReference: request.sourceReference ?? current.sourceReference,
			topic: request.topic ?? current.topic,
			hint: request.hint ?? current.hint,
			vocabularyItemId: current.vocabularyItemId,
		});
	}
}
