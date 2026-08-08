import type { Clock } from "@/application/ports/clock";
import type { IdGenerator } from "@/application/ports/id-generator";
import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { ReviewRepository } from "@/application/ports/repositories/review.repository";
import type { Command, UseCase } from "@/application/use-case";
import {
	currentQuestionId,
	type QuizAttemptId,
	QuizAttemptMode,
	startQuizAttempt,
	toQuizAttemptId,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { Question, QuestionId } from "@/domain/quiz-set/question";
import { type QuizSet, QuizSetStatus } from "@/domain/quiz-set/quiz-set";
import { AttemptAlreadyInProgressError } from "../attempts/start-quiz-attempt";

export const DEFAULT_SESSION_SIZE = 10;
/** A topic needs this many answers before its accuracy is worth trusting. */
export const MIN_ANSWERS_FOR_WEAK_TOPIC = 3;

export class NothingToReviewError extends Error {
	readonly mode: SessionMode;

	constructor(mode: SessionMode) {
		super(
			mode === QuizAttemptMode.Mistakes
				? "Nothing is due for review right now"
				: "Not enough answered questions yet to find a weak topic",
		);
		this.mode = mode;
		this.name = "NothingToReviewError";
	}
}

export type SessionMode =
	| typeof QuizAttemptMode.Mistakes
	| typeof QuizAttemptMode.WeakTopics;

export interface StartReviewSessionCommand {
	readonly telegramUserId: number;
	readonly mode: SessionMode;
	readonly limit?: number;
}

export interface StartReviewSessionResult {
	readonly attemptId: QuizAttemptId;
	readonly questionCount: number;
	readonly currentQuestionId?: QuestionId;
	/** The topic a weak-topic session was built from, when there is one. */
	readonly topic?: string;
}

export interface StartReviewSessionDependencies {
	readonly quizSets: QuizSetRepository;
	readonly attempts: QuizAttemptRepository;
	readonly reviews: ReviewRepository;
	readonly clock: Clock;
	readonly idGenerator: IdGenerator;
}

interface Selection {
	readonly quizSet: QuizSet;
	readonly questionIds: readonly QuestionId[];
	readonly topic?: string;
}

/**
 * Builds a practice session from the user's own history.
 *
 * An attempt belongs to exactly one quiz set, while mistakes and topics span the
 * whole library, so a session is scoped to the single set that contributes the
 * most candidate questions. Ties break on the lowest set id, and question order
 * follows the set, which keeps selection deterministic — the §5.2 gate.
 */
export class StartReviewSession
	implements
		UseCase<Command<StartReviewSessionCommand>, StartReviewSessionResult>
{
	private readonly quizSets: QuizSetRepository;
	private readonly attempts: QuizAttemptRepository;
	private readonly reviews: ReviewRepository;
	private readonly clock: Clock;
	private readonly idGenerator: IdGenerator;

	constructor(dependencies: StartReviewSessionDependencies) {
		this.quizSets = dependencies.quizSets;
		this.attempts = dependencies.attempts;
		this.reviews = dependencies.reviews;
		this.clock = dependencies.clock;
		this.idGenerator = dependencies.idGenerator;
	}

	async execute(
		request: Command<StartReviewSessionCommand>,
	): Promise<StartReviewSessionResult> {
		const unfinished = this.attempts.findActiveByUser(request.telegramUserId);

		if (unfinished !== undefined) {
			throw new AttemptAlreadyInProgressError(
				unfinished.id,
				unfinished.quizSetId,
			);
		}

		const limit = request.limit ?? DEFAULT_SESSION_SIZE;
		const selection =
			request.mode === QuizAttemptMode.Mistakes
				? this.selectMistakes(request.telegramUserId, limit)
				: this.selectWeakTopic(request.telegramUserId, limit);

		if (selection === undefined) {
			throw new NothingToReviewError(request.mode);
		}

		const at = this.clock.now();
		const attempt = startQuizAttempt({
			id: toQuizAttemptId(this.idGenerator.generate()),
			quizSetId: selection.quizSet.id,
			telegramUserId: request.telegramUserId,
			mode: request.mode,
			questionIds: selection.questionIds,
			startedAt: at,
		});

		this.attempts.save(attempt);

		return {
			attemptId: attempt.id,
			questionCount: attempt.questionIds.length,
			currentQuestionId: currentQuestionId(attempt),
			topic: selection.topic,
		};
	}

	/** Published sets only — a draft or archived set is not practice material. */
	private publishedSets(): readonly QuizSet[] {
		return this.quizSets
			.list({ statuses: [QuizSetStatus.Published] })
			.map((summary) => this.quizSets.findById(summary.id))
			.filter((quizSet): quizSet is QuizSet => quizSet !== undefined);
	}

	private selectMistakes(
		telegramUserId: number,
		limit: number,
	): Selection | undefined {
		const dueIds = new Set(
			this.reviews
				.listDue(telegramUserId, this.clock.now(), limit * 10)
				.map((item) => String(item.questionId)),
		);

		if (dueIds.size === 0) {
			return undefined;
		}

		return this.bestSet(
			this.publishedSets(),
			(question) => dueIds.has(String(question.id)),
			limit,
		);
	}

	private selectWeakTopic(
		telegramUserId: number,
		limit: number,
	): Selection | undefined {
		const weakest = this.attempts
			.topicAccuracy(telegramUserId)
			.filter(
				(entry) =>
					entry.topic !== undefined &&
					entry.answered >= MIN_ANSWERS_FOR_WEAK_TOPIC,
			)
			.map((entry) => ({
				topic: entry.topic as string,
				accuracy: entry.correct / entry.answered,
			}))
			.toSorted((left, right) =>
				left.accuracy === right.accuracy
					? left.topic.localeCompare(right.topic)
					: left.accuracy - right.accuracy,
			)
			.at(0);

		if (weakest === undefined) {
			return undefined;
		}

		const selection = this.bestSet(
			this.publishedSets(),
			(question) => question.topic === weakest.topic,
			limit,
		);

		return selection === undefined
			? undefined
			: { ...selection, topic: weakest.topic };
	}

	private bestSet(
		sets: readonly QuizSet[],
		matches: (question: Question) => boolean,
		limit: number,
	): Selection | undefined {
		// Rank on how many questions each set actually offers, then trim. Slicing
		// first made a set with 15 matches tie with one holding 12 and lose on id.
		const candidates = sets
			.map((quizSet) => ({
				quizSet,
				matched: quizSet.questions.filter(matches).length,
				questionIds: quizSet.questions
					.filter(matches)
					.slice(0, limit)
					.map((question) => question.id),
			}))
			.filter((candidate) => candidate.questionIds.length > 0)
			.toSorted((left, right) =>
				left.matched === right.matched
					? String(left.quizSet.id).localeCompare(String(right.quizSet.id))
					: right.matched - left.matched,
			);

		return candidates.at(0);
	}
}
