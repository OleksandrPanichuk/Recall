import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Command, UseCase } from "@/application/use-case";
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
import { shuffled } from "@/shared/utils/shuffle";
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
	readonly telegramUserId: number;
	readonly onlyDue?: boolean;
}

export interface StartQuizAttemptResult {
	readonly attemptId: QuizAttemptId;
	readonly resumed: boolean;
	readonly currentQuestionId?: QuestionId;
}

export interface StartQuizAttemptDependencies {
	readonly quizSets: QuizSetRepository;
	readonly attempts: QuizAttemptRepository;
	readonly clock: Clock;
	readonly idGenerator: IdGenerator;
	readonly repetition: RepetitionRepository;
}

export class StartQuizAttemptUseCase
	implements UseCase<Command<StartQuizAttemptCommand>, StartQuizAttemptResult>
{
	private readonly quizSets: QuizSetRepository;
	private readonly attempts: QuizAttemptRepository;
	private readonly clock: Clock;
	private readonly idGenerator: IdGenerator;
	private readonly repetition: RepetitionRepository;

	constructor(dependencies: StartQuizAttemptDependencies) {
		this.quizSets = dependencies.quizSets;
		this.attempts = dependencies.attempts;
		this.clock = dependencies.clock;
		this.idGenerator = dependencies.idGenerator;
		this.repetition = dependencies.repetition;
	}

	async execute(
		request: Command<StartQuizAttemptCommand>,
	): Promise<StartQuizAttemptResult> {
		const quizSet = this.quizSets.findById(request.quizSetId);

		if (quizSet === undefined) {
			throw new QuizSetNotFoundError(request.quizSetId);
		}

		if (quizSet.status !== QuizSetStatus.Published) {
			throw new QuizSetNotPublishedError(request.quizSetId);
		}

		const unfinished = this.attempts.findActiveByUser(request.telegramUserId);

		if (unfinished !== undefined) {
			if (unfinished.quizSetId !== request.quizSetId) {
				throw new AttemptAlreadyInProgressError(
					unfinished.id,
					unfinished.quizSetId,
				);
			}

			return this.resume(unfinished);
		}

		const at = this.clock.now();
		const everyQuestion = quizSet.questions.map((question) => question.id);
		const due =
			request.onlyDue === true
				? new Set(
						this.repetition
							.listDue(request.telegramUserId, at)
							.map((schedule) => schedule.questionId),
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
		const { shuffleQuestions } = resolveWithSource(
			this.repetition,
			quizSet.id,
		).settings;

		const attempt = startQuizAttempt({
			id,
			quizSetId: quizSet.id,
			telegramUserId: request.telegramUserId,
			mode: QuizAttemptMode.Full,
			questionIds: shuffleQuestions ? shuffled(questionIds, id) : questionIds,
			startedAt: at,
		});

		this.attempts.save(attempt);

		return {
			attemptId: attempt.id,
			resumed: false,
			currentQuestionId: currentQuestionId(attempt),
		};
	}

	private resume(attempt: QuizAttempt): StartQuizAttemptResult {
		if (attempt.status === QuizAttemptStatus.Paused) {
			const resumed = resumeQuizAttempt(attempt, this.clock.now());

			this.attempts.save(resumed);

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
