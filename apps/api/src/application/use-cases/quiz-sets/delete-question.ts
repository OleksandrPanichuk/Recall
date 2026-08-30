import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
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

export type DeleteQuestionDependencies = ApplicationDependencies;

export class DeleteQuestionUseCase
	implements UseCase<Command<DeleteQuestionCommand>, DeleteQuestionResult>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;

	constructor(dependencies: DeleteQuestionDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
	}

	async execute(
		request: Command<DeleteQuestionCommand>,
	): Promise<DeleteQuestionResult> {
		return this.unitOfWork.run(async ({ quizzes, attempts }) => {
			const quizSet = await quizzes.findById(request.quizSetId);

			if (quizSet === undefined) {
				throw new QuizSetNotFoundError(request.quizSetId);
			}

			const current = quizSet.questions.find(
				(question) => String(question.id) === String(request.questionId),
			);

			if (current === undefined) {
				throw new QuestionNotFoundError(request.quizSetId, request.questionId);
			}

			const answers = await attempts.answerCount(current.id);

			if (answers > 0) {
				throw new AnsweredQuestionError(current.id, answers);
			}

			const updated = replaceQuestions(
				quizSet,
				[],
				[current.id],
				this.clock.now(),
			);

			await quizzes.save(updated);

			return { questionId: current.id, remaining: updated.questions.length };
		});
	}
}
