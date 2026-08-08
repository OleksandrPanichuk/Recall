import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Command, UseCase } from "@/application/use-case";
import {
	currentQuestionId,
	type QuizAttemptId,
	type QuizAttemptMode,
	type QuizAttemptStatus,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { Question } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type { AttemptOfUserCommand } from "./resume-quiz-attempt";

export interface CurrentQuestionView {
	readonly attemptId: QuizAttemptId;
	readonly quizSetId: QuizSetId;
	readonly quizSetTitle: string;
	readonly status: QuizAttemptStatus;
	/** Full run, mistakes practice, or a weak-topic drill. */
	readonly mode: QuizAttemptMode;
	/**
	 * Absent once every planned question has been answered, or if the question
	 * itself has since been removed from the set.
	 */
	readonly question?: Question;
	/** Zero-based position in the attempt's plan. */
	readonly index: number;
	readonly total: number;
	/** True when the only thing left to do with this attempt is finish it. */
	readonly awaitingFinish: boolean;
}

export interface GetCurrentQuestionDependencies {
	readonly quizSets: QuizSetRepository;
	readonly attempts: QuizAttemptRepository;
}

/**
 * The state of the user's unfinished attempt, if they have one.
 *
 * Resolving to `undefined` means "no unfinished attempt" and nothing else. An
 * attempt whose questions are all answered still resolves — it is exactly the
 * state that needs a Finish button, and reporting it as absent is how a user
 * ends up blocked from starting anything while being told to finish something
 * the interface no longer offers.
 */
export class GetCurrentQuestion
	implements
		UseCase<Command<AttemptOfUserCommand>, CurrentQuestionView | undefined>
{
	private readonly quizSets: QuizSetRepository;
	private readonly attempts: QuizAttemptRepository;

	constructor(dependencies: GetCurrentQuestionDependencies) {
		this.quizSets = dependencies.quizSets;
		this.attempts = dependencies.attempts;
	}

	async execute(
		request: Command<AttemptOfUserCommand>,
	): Promise<CurrentQuestionView | undefined> {
		const attempt = this.attempts.findActiveByUser(request.telegramUserId);

		if (attempt === undefined) {
			return undefined;
		}

		const quizSet = this.quizSets.findById(attempt.quizSetId);
		const questionId = currentQuestionId(attempt);
		const question =
			questionId === undefined
				? undefined
				: quizSet?.questions.find((candidate) => candidate.id === questionId);

		return {
			attemptId: attempt.id,
			quizSetId: attempt.quizSetId,
			quizSetTitle: quizSet?.title ?? "",
			status: attempt.status,
			mode: attempt.mode,
			question,
			index: attempt.responses.length,
			total: attempt.questionIds.length,
			awaitingFinish: question === undefined,
		};
	}
}
