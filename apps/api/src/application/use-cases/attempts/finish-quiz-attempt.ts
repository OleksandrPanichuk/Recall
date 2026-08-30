import { startOfDayIn } from "@recall/kit";
import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import {
	attemptScore,
	completeQuizAttempt,
	type QuizAttemptId,
	QuizAttemptMode,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { Score } from "@/domain/quiz-attempt/score";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { scheduleAfter } from "@/domain/repetition/repetition";
import { resolveRepetitionSettings } from "../settings/resolve-quiz-settings";
import {
	type AttemptOfUserCommand,
	NoActiveAttemptError,
} from "./resume-quiz-attempt";

export interface FinishQuizAttemptResult {
	readonly attemptId: QuizAttemptId;
	readonly quizSetId: QuizSetId;
	readonly score: Score;
	readonly unansweredCount: number;
}

export type FinishQuizAttemptDependencies = ApplicationDependencies;

export class FinishQuizAttemptUseCase
	implements UseCase<Command<AttemptOfUserCommand>, FinishQuizAttemptResult>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;
	private readonly timezone: string;

	constructor(dependencies: FinishQuizAttemptDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
		this.timezone = dependencies.timezone;
	}

	async execute(
		_request: Command<AttemptOfUserCommand>,
	): Promise<FinishQuizAttemptResult> {
		const at = this.clock.now();
		const finished = await this.unitOfWork.run(
			async ({ attempts, reviews }) => {
				const attempt = await attempts.findActive();

				if (attempt === undefined) {
					throw new NoActiveAttemptError();
				}

				const completed = completeQuizAttempt(attempt, at);

				await attempts.save(completed);

				if (
					completed.responses.length === 0 ||
					completed.mode !== QuizAttemptMode.Full
				) {
					return completed;
				}

				const settings = await resolveRepetitionSettings(
					reviews,
					completed.quizSetId,
				);
				const dayStart = startOfDayIn(at, this.timezone);
				const answeredIds = completed.responses.map(
					(response) => response.questionId,
				);
				const existing = new Map(
					(await reviews.findSchedules(answeredIds)).map((schedule) => [
						schedule.questionId,
						schedule,
					]),
				);

				await reviews.saveSchedules(
					completed.responses.map((response) =>
						scheduleAfter(
							existing.get(response.questionId),
							response.questionId,
							completed.telegramUserId,
							settings,
							at,
							dayStart,
							response.isCorrect,
						),
					),
				);

				return completed;
			},
		);

		return {
			attemptId: finished.id,
			quizSetId: finished.quizSetId,
			unansweredCount: finished.questionIds.length - finished.responses.length,
			score: attemptScore(finished),
		};
	}
}
