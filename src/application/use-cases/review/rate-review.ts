import type { Clock } from "@/application/ports/clock";
import type { ReviewRepository } from "@/application/ports/repositories/review.repository";
import type { Command, UseCase } from "@/application/use-case";
import type { QuestionId } from "@/domain/quiz-set/question";
import { rescheduleReview } from "@/domain/review/review-item";
import {
	nextReviewDueAt,
	type ReviewRating,
} from "@/domain/review/review-schedule";

export class NoReviewItemError extends Error {
	constructor(questionId: QuestionId) {
		super(`Question ${questionId} is not in the review queue`);
		this.name = "NoReviewItemError";
	}
}

export interface RateReviewCommand {
	readonly telegramUserId: number;
	readonly questionId: QuestionId;
	readonly rating: ReviewRating;
}

export interface RateReviewResult {
	readonly dueAt: Date;
}

export interface RateReviewDependencies {
	readonly reviews: ReviewRepository;
	readonly clock: Clock;
	readonly timezone: string;
}

/**
 * Adjusts when a question comes back, without re-scoring it. Answering already
 * moved the streak; a rating only says how comfortable that answer felt, so it
 * moves the due date and nothing else.
 */
export class RateReview
	implements UseCase<Command<RateReviewCommand>, RateReviewResult>
{
	private readonly reviews: ReviewRepository;
	private readonly clock: Clock;
	private readonly timezone: string;

	constructor(dependencies: RateReviewDependencies) {
		this.reviews = dependencies.reviews;
		this.clock = dependencies.clock;
		this.timezone = dependencies.timezone;
	}

	async execute(
		request: Command<RateReviewCommand>,
	): Promise<RateReviewResult> {
		const item = this.reviews.findByQuestion(
			request.telegramUserId,
			request.questionId,
		);

		if (item === undefined) {
			throw new NoReviewItemError(request.questionId);
		}

		const dueAt = nextReviewDueAt({
			streak: item.streak,
			rating: request.rating,
			at: this.clock.now(),
			timezone: this.timezone,
		});

		this.reviews.save(rescheduleReview(item, dueAt));

		return { dueAt };
	}
}
