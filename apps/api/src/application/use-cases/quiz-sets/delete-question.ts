import type { Clock } from "@/application/ports/clock";
import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { QuestionId } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { replaceQuestions } from "@/domain/quiz-set/quiz-set";
import { QuestionNotFoundError } from "./update-question";
import { QuizSetNotFoundError } from "./update-quiz-set";

export class AnsweredQuestionError extends Error {
	readonly questionId: QuestionId;
	readonly answers: number;

	constructor(questionId: QuestionId, answers: number) {
		super(
			`Question ${questionId} has ${answers} recorded answers; deleting it would take them with it. Edit it instead.`,
		);
		this.name = "AnsweredQuestionError";
		this.questionId = questionId;
		this.answers = answers;
	}
}

export interface DeleteQuestionCommand {
	readonly quizSetId: QuizSetId;
	readonly questionId: QuestionId;
}

export interface DeleteQuestionResult {
	readonly questionId: QuestionId;
	readonly remaining: number;
}

export interface DeleteQuestionDependencies {
	readonly quizSets: QuizSetRepository;
	readonly attempts: QuizAttemptRepository;
	readonly clock: Clock;
}

export class DeleteQuestionUseCase
	implements UseCase<Command<DeleteQuestionCommand>, DeleteQuestionResult>
{
	private readonly quizSets: QuizSetRepository;
	private readonly attempts: QuizAttemptRepository;
	private readonly clock: Clock;

	constructor(dependencies: DeleteQuestionDependencies) {
		this.quizSets = dependencies.quizSets;
		this.attempts = dependencies.attempts;
		this.clock = dependencies.clock;
	}

	async execute(
		request: Command<DeleteQuestionCommand>,
	): Promise<DeleteQuestionResult> {
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

		const answers = this.attempts.answerCount(current.id);

		if (answers > 0) {
			throw new AnsweredQuestionError(current.id, answers);
		}

		const updated = replaceQuestions(
			quizSet,
			[],
			[current.id],
			this.clock.now(),
		);

		this.quizSets.save(updated);

		return { questionId: current.id, remaining: updated.questions.length };
	}
}
