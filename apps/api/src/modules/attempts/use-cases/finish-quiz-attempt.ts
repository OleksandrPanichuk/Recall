import { Injectable } from "@nestjs/common";
import { startOfDayIn } from "@recall/kit";
import { Clock } from "@/core/ports/clock";
import { Timezone } from "@/core/ports/timezone";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import {
	type QuestionId,
	type QuizSetId,
	QuizzesRepository,
} from "@/modules/quizzes";
import {
	gradeOf,
	type RecallGrade,
	ScheduleEntity,
	SchedulesRepository,
} from "@/modules/scheduling";
import { StudySettingsService } from "@/modules/study-settings";
import { AttemptEntity } from "../attempt.entity";
import { type QuizAttemptId } from "../attempt.entity.types";
import { QuizAttemptMode } from "../attempts.constants";
import { AttemptsRepository } from "../attempts.repository";
import type { Score } from "../score";
import {
	type AttemptOfUserCommand,
	NoActiveAttemptError,
} from "./resume-quiz-attempt";

export type FinishQuizAttemptUseCaseOptions = AttemptOfUserCommand;

export interface ScheduledQuestion {
	readonly questionId: QuestionId;
	readonly prompt: string;
	readonly grade: RecallGrade;
	readonly dueAt?: Date;
}

export interface FinishQuizAttemptResult {
	readonly attemptId: QuizAttemptId;
	readonly quizSetId: QuizSetId;
	readonly mode: QuizAttemptMode;
	readonly score: Score;
	readonly unansweredCount: number;
	readonly scheduled: readonly ScheduledQuestion[];
}

type Options = FinishQuizAttemptUseCaseOptions;
type Result = FinishQuizAttemptResult;

@Injectable()
export class FinishQuizAttemptUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly attempts: AttemptsRepository,
		private readonly quizzes: QuizzesRepository,
		private readonly schedules: SchedulesRepository,
		private readonly settings: StudySettingsService,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
		private readonly timezone: Timezone,
	) {
		super();
	}

	async execute(_options: Options): Promise<Result> {
		const at = this.clock.now();
		const { finished, scheduled } = await this.transaction.run(async () => {
			const attempt = await this.attempts.findActive();

			if (attempt === undefined) {
				throw new NoActiveAttemptError();
			}

			const completed = AttemptEntity.complete(attempt, at);

			await this.attempts.save(completed);

			if (
				completed.responses.length === 0 ||
				completed.mode !== QuizAttemptMode.Full
			) {
				return { finished: completed, scheduled: [] };
			}

			const settings = await this.settings.repetitionFor(completed.quizSetId);
			const dayStart = startOfDayIn(at, this.timezone.name());
			const answeredIds = completed.responses.map(
				(response) => response.questionId,
			);
			const existing = new Map(
				(await this.schedules.findSchedules(answeredIds)).map((schedule) => [
					schedule.questionId,
					schedule,
				]),
			);
			const graded = completed.responses.map((response) => {
				const grade = gradeOf(response.isCorrect, response.recall);

				return {
					grade,
					schedule: ScheduleEntity.scheduleAfter(
						existing.get(response.questionId),
						response.questionId,
						completed.telegramUserId,
						settings,
						at,
						dayStart,
						grade,
					),
				};
			});

			await this.schedules.saveSchedules(
				graded.map(({ schedule }) => schedule),
			);

			const prompts = new Map(
				(
					(await this.quizzes.findById(completed.quizSetId))?.questions ?? []
				).map((question) => [question.id, question.prompt]),
			);

			return {
				finished: completed,
				scheduled: graded.flatMap(({ grade, schedule }) => {
					const prompt = prompts.get(schedule.questionId);

					return prompt === undefined
						? []
						: [
								{
									questionId: schedule.questionId,
									prompt,
									grade,
									dueAt: schedule.dueAt,
								},
							];
				}),
			};
		});

		return {
			attemptId: finished.id,
			quizSetId: finished.quizSetId,
			mode: finished.mode,
			unansweredCount: finished.questionIds.length - finished.responses.length,
			score: AttemptEntity.score(finished),
			scheduled,
		};
	}
}
