import type { Clock } from "@/application/ports/clock";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type { UnitOfWork } from "@/application/ports/unit-of-work";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
import {
	type Answer,
	acceptedAnswers,
	correctOptionIds,
	gradeAnswer,
	isFullyCorrect,
	type OptionPair,
	optionsAnswer,
	orderAnswer,
	pairsAnswer,
	textAnswer,
} from "@/domain/quiz-attempt/answer";
import type { AnswerGrade } from "@/domain/quiz-attempt/answer.types";
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
	expectsTypedAnswer,
	type Question,
	type QuestionId,
	type QuestionOptionId,
	QuestionType,
} from "@/domain/quiz-set/question";
import { isWithinOneEdit } from "@/shared/utils/edit-distance";
import { normaliseForComparison } from "@/shared/utils/text";
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
	readonly credit: AnswerGrade;
}

export type AnswerQuestionDependencies = ApplicationDependencies;

export class AnswerQuestionUseCase
	implements UseCase<Command<AnswerQuestionCommand>, AnswerQuestionResult>
{
	private readonly unitOfWork: UnitOfWork<RepositoryScope>;
	private readonly clock: Clock;

	constructor(dependencies: AnswerQuestionDependencies) {
		this.unitOfWork = dependencies.unitOfWork;
		this.clock = dependencies.clock;
	}

	async execute(
		request: Command<AnswerQuestionCommand>,
	): Promise<AnswerQuestionResult> {
		const at = this.clock.now();

		return this.unitOfWork.run(async ({ quizzes, attempts }) => {
			const attempt = await attempts.findActiveFor(request.telegramUserId);

			if (attempt === undefined) {
				throw new NoActiveAttemptError(request.telegramUserId);
			}

			if (attempt.status !== Status.Active) {
				throw new AttemptNotActiveError(attempt.status);
			}

			const quizSet = await quizzes.findById(attempt.quizSetId);
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
					{
						earned: recorded.creditEarned ?? (recorded.isCorrect ? 1 : 0),
						possible: recorded.creditPossible ?? 1,
					},
					recorded.typedAnswer,
				);
			}

			const selectedOptionIds = selectedIdsOf(
				question,
				request.selectedOptionPositions ?? [],
			);
			const grade =
				request.revealed === true
					? { earned: 0, possible: 1 }
					: gradeAnswer(
							question,
							answerOf(question, selectedOptionIds, request.typedAnswer),
						);
			const isCorrect = isFullyCorrect(grade);
			const answered = recordResponse(attempt, {
				questionId: request.questionId,
				selectedOptionIds,
				isCorrect,
				answeredAt: at,
				typedAnswer: request.typedAnswer,
				skipped: request.revealed === true ? true : undefined,
				creditEarned: grade.earned,
				creditPossible: grade.possible,
			});

			await attempts.save(answered);

			return this.resultOf(
				answered,
				isCorrect,
				false,
				question,
				grade,
				request.typedAnswer,
			);
		});
	}

	private resultOf(
		attempt: QuizAttempt,
		isCorrect: boolean,
		alreadyAnswered: boolean,
		question: Question,
		grade: AnswerGrade,
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
			credit: grade,
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
	const candidate = normaliseForComparison(typed);

	return acceptedAnswers(question).find((accepted) =>
		isWithinOneEdit(candidate, normaliseForComparison(accepted)),
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
