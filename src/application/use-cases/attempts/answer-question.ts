import type { Clock } from "@/application/ports/clock";
import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { Transaction } from "@/application/ports/transaction";
import type { Command, UseCase } from "@/application/use-case";
import {
	type Answer,
	acceptedAnswers,
	correctOptionIds,
	evaluateAnswer,
	type OptionPair,
	optionsAnswer,
	orderAnswer,
	pairsAnswer,
	textAnswer,
} from "@/domain/quiz-attempt/answer";
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
import {
	isNearMiss,
	normaliseAnswer,
} from "@/domain/quiz-set/answer-normalisation";
import {
	expectsTypedAnswer,
	type Question,
	type QuestionId,
	type QuestionOptionId,
	QuestionType,
} from "@/domain/quiz-set/question";
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
	readonly selectedOptionPositions?: readonly number[];
	readonly typedAnswer?: string;
	readonly revealed?: boolean;
}

export interface AnswerQuestionResult {
	readonly isCorrect: boolean;
	readonly alreadyAnswered: boolean;
	readonly explanation?: string;
	readonly correctOptionIds: readonly QuestionOptionId[];
	readonly nextQuestionId?: QuestionId;
	readonly score: Score;
	readonly question: Question;
	readonly acceptedAnswers: readonly string[];
	readonly typedAnswer?: string;
	readonly nearMiss?: string;
}

export interface AnswerQuestionDependencies {
	readonly quizSets: QuizSetRepository;
	readonly attempts: QuizAttemptRepository;
	readonly clock: Clock;
	readonly transaction: Transaction;
}

export class AnswerQuestion
	implements UseCase<Command<AnswerQuestionCommand>, AnswerQuestionResult>
{
	private readonly quizSets: QuizSetRepository;
	private readonly attempts: QuizAttemptRepository;
	private readonly clock: Clock;
	private readonly transaction: Transaction;

	constructor(dependencies: AnswerQuestionDependencies) {
		this.quizSets = dependencies.quizSets;
		this.attempts = dependencies.attempts;
		this.clock = dependencies.clock;
		this.transaction = dependencies.transaction;
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

			const recorded = attempt.responses.find(
				(response) => response.questionId === request.questionId,
			);

			if (recorded !== undefined) {
				return this.resultOf(
					attempt,
					recorded.isCorrect,
					true,
					question,
					recorded.typedAnswer,
				);
			}

			const selectedOptionIds = selectedIdsOf(
				question,
				request.selectedOptionPositions ?? [],
			);
			const isCorrect =
				request.revealed === true
					? false
					: evaluateAnswer(
							question,
							answerOf(question, selectedOptionIds, request.typedAnswer),
						);
			const answered = recordResponse(attempt, {
				questionId: request.questionId,
				selectedOptionIds,
				isCorrect,
				answeredAt: at,
				typedAnswer: request.typedAnswer,
				skipped: request.revealed === true ? true : undefined,
			});

			this.attempts.save(answered);

			return this.resultOf(
				answered,
				isCorrect,
				false,
				question,
				request.typedAnswer,
			);
		});
	}

	private resultOf(
		attempt: QuizAttempt,
		isCorrect: boolean,
		alreadyAnswered: boolean,
		question: Question,
		typedAnswer?: string,
	): AnswerQuestionResult {
		return {
			isCorrect,
			alreadyAnswered,
			explanation: question.explanation,
			acceptedAnswers: expectsTypedAnswer(question)
				? acceptedAnswers(question)
				: [],
			typedAnswer,
			nearMiss:
				isCorrect || typedAnswer === undefined
					? undefined
					: nearMissOf(question, typedAnswer),
			correctOptionIds: correctOptionIds(question),
			question,
			nextQuestionId: currentQuestionId(attempt),
			score: attemptScore(attempt),
		};
	}
}

function answerOf(
	question: Question,
	selectedOptionIds: readonly QuestionOptionId[],
	typed: string | undefined,
): Answer {
	if (expectsTypedAnswer(question)) {
		return textAnswer(typed ?? "");
	}

	if (question.type === QuestionType.Ordering) {
		return orderAnswer(selectedOptionIds);
	}

	if (question.type === QuestionType.Matching) {
		return pairsAnswer(pairsOf(selectedOptionIds));
	}

	return optionsAnswer(selectedOptionIds);
}

// Matching arrives as a flat left, right, left, right sequence, because that is
// what a Telegram keyboard can send and what one JSON column can store.
function pairsOf(
	optionIds: readonly QuestionOptionId[],
): readonly OptionPair[] {
	if (optionIds.length % 2 !== 0) {
		throw new QuizAttemptValidationError([
			"a matching answer must pair every selection",
		]);
	}

	const pairs: OptionPair[] = [];

	for (let index = 0; index < optionIds.length; index += 2) {
		pairs.push([
			optionIds[index] as QuestionOptionId,
			optionIds[index + 1] as QuestionOptionId,
		]);
	}

	return pairs;
}

function nearMissOf(question: Question, typed: string): string | undefined {
	const candidate = normaliseAnswer(typed);

	return acceptedAnswers(question).find((accepted) =>
		isNearMiss(candidate, normaliseAnswer(accepted)),
	);
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
