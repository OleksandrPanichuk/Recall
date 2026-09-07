import { Injectable } from "@nestjs/common";
import { shuffled } from "@recall/kit";
import { Clock } from "@/core/ports/clock";
import { IdGenerator } from "@/core/ports/id-generator";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import {
	type QuestionId,
	type QuizSetId,
	QuizSetNotFoundError,
	QuizSetStatus,
	QuizzesRepository,
} from "@/modules/quizzes";
import { SchedulesRepository } from "@/modules/scheduling";
import { StudySettingsService } from "@/modules/study-settings";
import { AttemptEntity, toQuizAttemptId } from "../attempt.entity";
import { type QuizAttemptId } from "../attempt.entity.types";
import { QuizAttemptMode, QuizAttemptStatus } from "../attempts.constants";
import { AttemptsRepository } from "../attempts.repository";

export class QuizSetNotPublishedError extends Error {
	constructor(quizSetId: QuizSetId) {
		super(`Quiz set ${quizSetId} is not published`);
		this.name = "QuizSetNotPublishedError";
	}
}

export class AttemptAlreadyInProgressError extends Error {
	readonly attemptId: QuizAttemptId;
	readonly quizSetId: QuizSetId;

	constructor(attemptId: QuizAttemptId, quizSetId: QuizSetId) {
		super(
			`Attempt ${attemptId} on quiz set ${quizSetId} is still unfinished; finish or abandon it first`,
		);
		this.name = "AttemptAlreadyInProgressError";
		this.attemptId = attemptId;
		this.quizSetId = quizSetId;
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

export interface StartQuizAttemptUseCaseOptions {
	readonly quizSetId: QuizSetId;
	readonly telegramUserId?: number;
	readonly onlyDue?: boolean;
}

export interface StartQuizAttemptResult {
	readonly attemptId: QuizAttemptId;
	readonly resumed: boolean;
	readonly currentQuestionId?: QuestionId;
}

type Options = StartQuizAttemptUseCaseOptions;
type Result = StartQuizAttemptResult;

@Injectable()
export class StartQuizAttemptUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly attempts: AttemptsRepository,
		private readonly quizzes: QuizzesRepository,
		private readonly schedules: SchedulesRepository,
		private readonly settings: StudySettingsService,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
		private readonly ids: IdGenerator,
	) {
		super();
	}

	execute(options: Options): Promise<Result> {
		return this.transaction.run(async () => {
			const quizSet = await this.quizzes.findById(options.quizSetId);

			if (quizSet === undefined) {
				throw new QuizSetNotFoundError(options.quizSetId);
			}

			if (quizSet.status !== QuizSetStatus.Published) {
				throw new QuizSetNotPublishedError(options.quizSetId);
			}

			const unfinished = await this.attempts.findActive();

			if (unfinished !== undefined) {
				if (unfinished.quizSetId !== options.quizSetId) {
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
				options.onlyDue === true
					? new Set(
							(await this.schedules.listDue(at)).map(
								(schedule) => schedule.questionId,
							),
						)
					: undefined;
			const questionIds =
				due === undefined
					? everyQuestion
					: everyQuestion.filter((questionId) => due.has(questionId));

			if (questionIds.length === 0) {
				throw new NothingDueError(options.quizSetId);
			}

			const id = toQuizAttemptId(this.ids.generate());
			const { shuffleQuestions } = (await this.settings.resolve(quizSet.id))
				.settings;

			const attempt = AttemptEntity.start({
				id,
				quizSetId: quizSet.id,
				telegramUserId: options.telegramUserId,
				mode: QuizAttemptMode.Full,
				questionIds: shuffleQuestions ? shuffled(questionIds, id) : questionIds,
				startedAt: at,
			});

			await this.attempts.save(attempt);

			return {
				attemptId: attempt.id,
				resumed: false,
				currentQuestionId: AttemptEntity.currentQuestionId(attempt),
			};
		});
	}

	private async resume(attempt: AttemptEntity): Promise<Result> {
		if (attempt.status === QuizAttemptStatus.Paused) {
			const resumed = AttemptEntity.resume(attempt, this.clock.now());

			await this.attempts.save(resumed);

			return {
				attemptId: resumed.id,
				resumed: true,
				currentQuestionId: AttemptEntity.currentQuestionId(resumed),
			};
		}

		return {
			attemptId: attempt.id,
			resumed: true,
			currentQuestionId: AttemptEntity.currentQuestionId(attempt),
		};
	}
}
