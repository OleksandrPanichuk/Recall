import type { Clock } from "@/application/ports/clock";
import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Command, UseCase } from "@/application/use-case";
import {
	attemptScore,
	completeQuizAttempt,
	type QuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { Score } from "@/domain/quiz-attempt/score";
import { scheduleAfter } from "@/domain/repetition/repetition";
import { resolveRepetitionSettings } from "../repetition/resolve-repetition-settings";
import {
	type AttemptOfUserCommand,
	NoActiveAttemptError,
} from "./resume-quiz-attempt";

export interface FinishQuizAttemptResult {
	readonly attemptId: QuizAttemptId;
	readonly score: Score;
	readonly unansweredCount: number;
}

export interface FinishQuizAttemptDependencies {
	readonly attempts: QuizAttemptRepository;
	readonly repetition: RepetitionRepository;
	readonly clock: Clock;
}

export class FinishQuizAttempt
	implements UseCase<Command<AttemptOfUserCommand>, FinishQuizAttemptResult>
{
	private readonly attempts: QuizAttemptRepository;
	private readonly repetition: RepetitionRepository;
	private readonly clock: Clock;

	constructor(dependencies: FinishQuizAttemptDependencies) {
		this.attempts = dependencies.attempts;
		this.repetition = dependencies.repetition;
		this.clock = dependencies.clock;
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

		this.attempts.save(finished);
		this.repetition.saveSchedule(
			scheduleAfter(
				this.repetition.findSchedule(
					finished.quizSetId,
					finished.telegramUserId,
				),
				finished.quizSetId,
				finished.telegramUserId,
				resolveRepetitionSettings(this.repetition, finished.quizSetId),
				at,
			),
		);

		return {
			attemptId: finished.id,
			unansweredCount: finished.questionIds.length - finished.responses.length,
			score: attemptScore(finished),
		};
	}
}
