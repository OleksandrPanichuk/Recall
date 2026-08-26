import { shuffled } from "@recall/kit";
import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import {
	currentQuestionId,
	type QuizAttempt,
	type QuizAttemptId,
	QuizAttemptMode,
	QuizAttemptStatus,
	resumeQuizAttempt,
	startQuizAttempt,
	toQuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { QuestionId } from "@/domain/quiz-set/question";
import { type QuizSetId, QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import { QuizSetNotFoundError } from "../quiz-sets/update-quiz-set";
import { resolveWithSource } from "../settings/resolve-quiz-settings";

export class QuizSetNotPublishedError extends Error {
	constructor(quizSetId: QuizSetId) {
		super(`Quiz set ${quizSetId} is not published`);
		this.name = "QuizSetNotPublishedError";
	}
}

export class AttemptAlreadyInProgressError extends Error {
	constructor(attemptId: QuizAttemptId, quizSetId: QuizSetId) {
		super(
			`Attempt ${attemptId} on quiz set ${quizSetId} is still unfinished; finish or abandon it first`,
		);
		this.name = "AttemptAlreadyInProgressError";
	}
}

export class NothingDueError extends Error {
	readonly quizSetId: QuizSetId;

	constructor(quizSetId: QuizSetId) {
		super(`Nothing is due for repetition in ${quizSetId}`);
		this.name = "NothingDueError";
		this.quizSetId = quizSetId;
	}
}

export interface StartQuizAttemptCommand {
	readonly quizSetId: QuizSetId;
	// Kept as provenance on the row, not as an identity the api trusts.
	readonly telegramUserId?: number;
	readonly onlyDue?: boolean;
}

export interface StartQuizAttemptResult {
	readonly attemptId: QuizAttemptId;
	readonly resumed: boolean;
	readonly currentQuestionId?: QuestionId;
}

export type StartQuizAttemptDependencies = ApplicationDependencies;

export class StartQuizAttemptUseCase
	implements UseCase<Command<StartQuizAttemptCommand>, StartQuizAttemptResult>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;
	private readonly idGenerator: IdGenerator;

	constructor(dependencies: StartQuizAttemptDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
		this.idGenerator = dependencies.idGenerator;
	}

	execute(
		request: Command<StartQuizAttemptCommand>,
	): Promise<StartQuizAttemptResult> {
		return this.unitOfWork.run(async (scope) => {
			const { quizzes, attempts, reviews } = scope;
			const quizSet = await quizzes.findById(request.quizSetId);

			if (quizSet === undefined) {
				throw new QuizSetNotFoundError(request.quizSetId);
			}

			if (quizSet.status !== QuizSetStatus.Published) {
				throw new QuizSetNotPublishedError(request.quizSetId);
			}

			const unfinished = await attempts.findActive();

			if (unfinished !== undefined) {
				if (unfinished.quizSetId !== request.quizSetId) {
					throw new AttemptAlreadyInProgressError(
						unfinished.id,
						unfinished.quizSetId,
					);
				}

				return this.resume(unfinished, attempts);
			}

			const at = this.clock.now();
			const everyQuestion = quizSet.questions.map((question) => question.id);
			const due =
				request.onlyDue === true
					? new Set(
							(await reviews.listDue(at)).map(
								(schedule) => schedule.questionId,
							),
						)
					: undefined;
			const questionIds =
				due === undefined
					? everyQuestion
					: everyQuestion.filter((questionId) => due.has(questionId));

			if (questionIds.length === 0) {
				throw new NothingDueError(request.quizSetId);
			}

			const id = toQuizAttemptId(this.idGenerator.generate());
			const { shuffleQuestions } = (
				await resolveWithSource(reviews, quizSet.id)
			).settings;

			const attempt = startQuizAttempt({
				id,
				quizSetId: quizSet.id,
				telegramUserId: request.telegramUserId,
				mode: QuizAttemptMode.Full,
				questionIds: shuffleQuestions ? shuffled(questionIds, id) : questionIds,
				startedAt: at,
			});

			await attempts.save(attempt);

			return {
				attemptId: attempt.id,
				resumed: false,
				currentQuestionId: currentQuestionId(attempt),
			};
		});
	}

	private async resume(
		attempt: QuizAttempt,
		attempts: RepositoryScope["attempts"],
	): Promise<StartQuizAttemptResult> {
		if (attempt.status === QuizAttemptStatus.Paused) {
			const resumed = resumeQuizAttempt(attempt, this.clock.now());

			await attempts.save(resumed);

			return {
				attemptId: resumed.id,
				resumed: true,
				currentQuestionId: currentQuestionId(resumed),
			};
		}

		return {
			attemptId: attempt.id,
			resumed: true,
			currentQuestionId: currentQuestionId(attempt),
		};
	}
}
