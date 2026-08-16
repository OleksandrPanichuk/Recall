import type { Clock } from "@/application/ports/clock";
import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { Command, UseCase } from "@/application/use-case";
import {
	attemptScore,
	completeQuizAttempt,
	type QuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { Score } from "@/domain/quiz-attempt/score";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { scheduleAfter } from "@/domain/repetition/repetition";
import { startOfDayIn } from "@/shared/utils/timezone";
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

export interface FinishQuizAttemptDependencies {
	readonly attempts: QuizAttemptRepository;
	readonly repetition: RepetitionRepository;
	readonly transaction: Transaction;
	readonly clock: Clock;
	readonly timezone: string;
}

export class FinishQuizAttempt
	implements UseCase<Command<AttemptOfUserCommand>, FinishQuizAttemptResult>
{
	private readonly attempts: QuizAttemptRepository;
	private readonly repetition: RepetitionRepository;
	private readonly transaction: Transaction;
	private readonly clock: Clock;
	private readonly timezone: string;

	constructor(dependencies: FinishQuizAttemptDependencies) {
		this.attempts = dependencies.attempts;
		this.repetition = dependencies.repetition;
		this.transaction = dependencies.transaction;
		this.clock = dependencies.clock;
		this.timezone = dependencies.timezone;
	}

	async execute(
		request: Command<AttemptOfUserCommand>,
	): Promise<FinishQuizAttemptResult> {
		const attempt = this.attempts.findActiveByUser(request.telegramUserId);

		if (attempt === undefined) {
			throw new NoActiveAttemptError(request.telegramUserId);
		}

		const at = this.clock.now();
		const finished = completeQuizAttempt(attempt, at);

		this.transaction.run(() => {
			this.attempts.save(finished);

			// An attempt abandoned without answering is not a repetition: advancing
			// on it would push the interval out and, repeated, retire a question the
			// owner never actually answered.
			if (finished.responses.length === 0) {
				return;
			}

			const settings = resolveRepetitionSettings(
				this.repetition,
				finished.quizSetId,
			);
			const dayStart = startOfDayIn(at, this.timezone);
			const answeredIds = finished.responses.map(
				(response) => response.questionId,
			);
			const existing = new Map(
				this.repetition
					.findSchedules(answeredIds, finished.telegramUserId)
					.map((schedule) => [schedule.questionId, schedule]),
			);

			this.repetition.saveSchedules(
				finished.responses.map((response) =>
					scheduleAfter(
						existing.get(response.questionId),
						response.questionId,
						finished.telegramUserId,
						settings,
						at,
						dayStart,
						response.isCorrect,
					),
				),
			);
		});

		return {
			attemptId: finished.id,
			quizSetId: finished.quizSetId,
			unansweredCount: finished.questionIds.length - finished.responses.length,
			score: attemptScore(finished),
		};
	}
}
