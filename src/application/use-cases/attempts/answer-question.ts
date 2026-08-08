import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { ReviewRepository } from "@/application/ports/repositories/review.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { Command, UseCase } from "@/application/use-case";
import { correctOptionIds, evaluateAnswer } from "@/domain/quiz-attempt/answer";
import {
	attemptScore,
	currentQuestionId,
	type QuizAttempt,
	type QuizAttemptStatus,
	recordResponse,
	QuizAttemptStatus as Status,
} from "@/domain/quiz-attempt/quiz-attempt";
import {
	QuestionNotInAttemptError,
	QuizAttemptValidationError,
} from "@/domain/quiz-attempt/quiz-attempt.errors";
import type { Score } from "@/domain/quiz-attempt/score";
import type {
	Question,
	QuestionId,
	QuestionOptionId,
} from "@/domain/quiz-set/question";
import {
	createReviewItem,
	markReviewFailed,
	markReviewPassed,
	type ReviewItem,
	ReviewItemState,
	reopenReviewItem,
	toReviewItemId,
} from "@/domain/review/review-item";
import { nextReviewDueAt, ReviewRating } from "@/domain/review/review-schedule";
import { NoActiveAttemptError } from "./resume-quiz-attempt";

export class AttemptNotActiveError extends Error {
	constructor(status: QuizAttemptStatus) {
		super(`A ${status} attempt cannot record an answer`);
		this.name = "AttemptNotActiveError";
	}
}

export interface AnswerQuestionCommand {
	readonly telegramUserId: number;
	readonly questionId: QuestionId;
	/**
	 * Option positions rather than ids. The adapter renders positions into its
	 * callback payloads, and resolving them here — against the question this use
	 * case already loads — means a stale payload can never be mapped against the
	 * wrong question's options.
	 */
	readonly selectedOptionPositions: readonly number[];
}

export interface AnswerQuestionResult {
	readonly isCorrect: boolean;
	readonly alreadyAnswered: boolean;
	readonly explanation?: string;
	readonly correctOptionIds: readonly QuestionOptionId[];
	readonly nextQuestionId?: QuestionId;
	readonly score: Score;
	/** The question just answered, so a presenter can name the options. */
	readonly question: Question;
	/** Set when the question sits in the review queue and can be rated. */
	readonly reviewDueAt?: Date;
}

export interface AnswerQuestionDependencies {
	readonly quizSets: QuizSetRepository;
	readonly attempts: QuizAttemptRepository;
	readonly clock: Clock;
	readonly transaction: Transaction;
	readonly reviews: ReviewRepository;
	readonly idGenerator: IdGenerator;
	readonly timezone: string;
	/** Called when the review queue could not be updated for a recorded answer. */
	readonly onReviewQueueError?: (error: unknown) => void;
}

export class AnswerQuestion
	implements UseCase<Command<AnswerQuestionCommand>, AnswerQuestionResult>
{
	private readonly quizSets: QuizSetRepository;
	private readonly attempts: QuizAttemptRepository;
	private readonly clock: Clock;
	private readonly transaction: Transaction;
	private readonly reviews: ReviewRepository;
	private readonly idGenerator: IdGenerator;
	private readonly timezone: string;
	private readonly onReviewQueueError: (error: unknown) => void;

	constructor(dependencies: AnswerQuestionDependencies) {
		this.quizSets = dependencies.quizSets;
		this.attempts = dependencies.attempts;
		this.clock = dependencies.clock;
		this.transaction = dependencies.transaction;
		this.reviews = dependencies.reviews;
		this.idGenerator = dependencies.idGenerator;
		this.timezone = dependencies.timezone;
		this.onReviewQueueError =
			dependencies.onReviewQueueError ??
			((error) => {
				console.error("review queue update failed", error);
			});
	}

	async execute(
		request: Command<AnswerQuestionCommand>,
	): Promise<AnswerQuestionResult> {
		const at = this.clock.now();

		return this.transaction.run(() => {
			const attempt = this.attempts.findActiveByUser(request.telegramUserId);

			if (attempt === undefined) {
				throw new NoActiveAttemptError(request.telegramUserId);
			}

			if (attempt.status !== Status.Active) {
				throw new AttemptNotActiveError(attempt.status);
			}

			const quizSet = this.quizSets.findById(attempt.quizSetId);
			const question = quizSet?.questions.find(
				(candidate) => candidate.id === request.questionId,
			);

			if (question === undefined) {
				throw new QuestionNotInAttemptError();
			}

			// A duplicated or stale callback replays an answer already recorded. Report
			// what was recorded rather than re-evaluating, so the outcome the user was
			// shown can never change under them and the score can never move twice.
			const recorded = attempt.responses.find(
				(response) => response.questionId === request.questionId,
			);

			if (recorded !== undefined) {
				return this.resultOf(
					attempt,
					recorded.isCorrect,
					true,
					question,
					this.reviewDueAt(request.telegramUserId, request.questionId),
				);
			}

			const selectedOptionIds = selectedIdsOf(
				question,
				request.selectedOptionPositions,
			);
			const isCorrect = evaluateAnswer(question, selectedOptionIds);
			const answered = recordResponse(attempt, {
				questionId: request.questionId,
				selectedOptionIds,
				isCorrect,
				answeredAt: at,
			});

			this.attempts.save(answered);

			// Recording the answer is the user's action; queueing it for review is a
			// convenience layered on top. Letting the second fail the first would mean
			// a scheduling bug makes a question permanently unanswerable, so the
			// review half is contained.
			try {
				this.updateReviewQueue(
					request.telegramUserId,
					request.questionId,
					isCorrect,
					at,
				);
			} catch (error) {
				this.onReviewQueueError(error);
			}

			return this.resultOf(
				answered,
				isCorrect,
				false,
				question,
				this.reviewDueAt(request.telegramUserId, request.questionId),
			);
		});
	}

	/**
	 * A wrong answer queues the question for review; a right one advances its
	 * streak. Both go through the repository's upsert on (user, question), so one
	 * question can never accumulate more than a single queue entry — the §5.1
	 * gate. Runs inside the same transaction as the answer, so an attempt and its
	 * review queue can never disagree.
	 */
	private updateReviewQueue(
		telegramUserId: number,
		questionId: QuestionId,
		isCorrect: boolean,
		at: Date,
	): void {
		const existing = this.reviews.findByQuestion(telegramUserId, questionId);

		if (!isCorrect) {
			this.reviews.save(
				this.queueMistake(existing, telegramUserId, questionId, at),
			);

			return;
		}

		if (existing === undefined || existing.state === ReviewItemState.Retired) {
			return;
		}

		// Spacing is the whole point: a question answered again before it is due has
		// not been remembered over an interval, it has been remembered over minutes.
		// Without this a mistake made at 11:00 retires by 15:00 the same day and
		// quietly leaves the queue having never been spaced at all.
		if (existing.dueAt.getTime() > at.getTime()) {
			return;
		}

		this.reviews.save(
			markReviewPassed(
				existing,
				at,
				nextReviewDueAt({
					streak: existing.streak + 1,
					rating: ReviewRating.Good,
					at,
					timezone: this.timezone,
				}),
			),
		);
	}

	private queueMistake(
		existing: ReviewItem | undefined,
		telegramUserId: number,
		questionId: QuestionId,
		at: Date,
	): ReviewItem {
		const dueAt = nextReviewDueAt({
			streak: 0,
			rating: ReviewRating.Hard,
			at,
			timezone: this.timezone,
		});

		if (existing === undefined) {
			return createReviewItem({
				id: toReviewItemId(this.idGenerator.generate()),
				questionId,
				telegramUserId,
				createdAt: at,
				dueAt,
			});
		}

		// Retirement means "learned", not "never ask again".
		return existing.state === ReviewItemState.Retired
			? reopenReviewItem(existing, at, dueAt)
			: markReviewFailed(existing, at, dueAt);
	}

	private resultOf(
		attempt: QuizAttempt,
		isCorrect: boolean,
		alreadyAnswered: boolean,
		question: Question,
		reviewDueAt: Date | undefined,
	): AnswerQuestionResult {
		return {
			isCorrect,
			alreadyAnswered,
			explanation: question.explanation,
			correctOptionIds: correctOptionIds(question),
			question,
			nextQuestionId: currentQuestionId(attempt),
			score: attemptScore(attempt),
			reviewDueAt,
		};
	}

	private reviewDueAt(
		telegramUserId: number,
		questionId: QuestionId,
	): Date | undefined {
		const item = this.reviews.findByQuestion(telegramUserId, questionId);

		// A retired card is out of rotation, so rescheduling it would promise a
		// review that listDue can never deliver.
		return item === undefined || item.state === ReviewItemState.Retired
			? undefined
			: item.dueAt;
	}
}

function selectedIdsOf(
	question: Question,
	positions: readonly number[],
): readonly QuestionOptionId[] {
	return positions.map((position) => {
		const option = question.options.find(
			(candidate) => candidate.position === position,
		);

		if (option === undefined) {
			throw new QuizAttemptValidationError([
				"selectedOptionIds must belong to the question",
			]);
		}

		return option.id;
	});
}
