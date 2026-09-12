import { Injectable } from "@nestjs/common";
import { normaliseForComparison } from "@recall/kit";
import { Clock } from "@/core/ports/clock";
import { Transaction } from "@/core/transaction";
import { UseCase } from "@/core/use-case";
import {
	QuestionEntity,
	type QuestionId,
	type QuestionOptionId,
	QuestionType,
	QuizzesRepository,
} from "@/modules/quizzes";
import { StudySettingsService } from "@/modules/study-settings";
import { isWithinOneEdit } from "@/shared/utils/edit-distance";
import { Answer } from "../answer";
import type { AnswerGrade, OptionPair } from "../answer.types";
import { AttemptEntity } from "../attempt.entity";
import { QuizAttemptMode, QuizAttemptStatus } from "../attempts.constants";
import {
	QuestionNotInAttemptError,
	QuizAttemptValidationError,
} from "../attempts.errors";
import { AttemptsRepository } from "../attempts.repository";
import type { Score } from "../score";
import { NoActiveAttemptError } from "./resume-quiz-attempt";

export class AttemptNotActiveError extends Error {
	constructor(status: QuizAttemptStatus) {
		super(`A ${status} attempt cannot record an answer`);
		this.name = "AttemptNotActiveError";
	}
}

export interface AnswerQuestionUseCaseOptions {
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
	readonly question: QuestionEntity;
	readonly acceptedAnswers: readonly string[];
	readonly typedAnswer?: string;
	readonly nearMiss?: string;
	readonly credit: AnswerGrade;
	readonly gradable: boolean;
}

type Options = AnswerQuestionUseCaseOptions;
type Result = AnswerQuestionResult;

@Injectable()
export class AnswerQuestionUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly attempts: AttemptsRepository,
		private readonly quizzes: QuizzesRepository,
		private readonly settings: StudySettingsService,
		private readonly transaction: Transaction,
		private readonly clock: Clock,
	) {
		super();
	}

	async execute(options: Options): Promise<Result> {
		const at = this.clock.now();

		return this.transaction.run(async () => {
			const attempt = await this.attempts.findActive();

			if (attempt === undefined) {
				throw new NoActiveAttemptError();
			}

			if (attempt.status !== QuizAttemptStatus.Active) {
				throw new AttemptNotActiveError(attempt.status);
			}

			const quizSet = await this.quizzes.findById(attempt.quizSetId);
			const question = quizSet?.questions.find(
				(candidate) => candidate.id === options.questionId,
			);

			if (question === undefined) {
				throw new QuestionNotInAttemptError();
			}

			const gradable =
				attempt.mode === QuizAttemptMode.Full &&
				(await this.settings.repetitionFor(attempt.quizSetId)).scheduler ===
					"fsrs";
			const recorded = attempt.responses.find(
				(response) => response.questionId === options.questionId,
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
					gradable,
				);
			}

			const selectedOptionIds = this.selectedIdsOf(
				question,
				options.selectedOptionPositions ?? [],
			);
			const grade =
				options.revealed === true
					? { earned: 0, possible: 1 }
					: Answer.grade(
							question,
							this.answerOf(question, selectedOptionIds, options.typedAnswer),
						);
			const isCorrect = Answer.isFullyCorrect(grade);
			const answered = AttemptEntity.recordResponse(attempt, {
				questionId: options.questionId,
				selectedOptionIds,
				isCorrect,
				answeredAt: at,
				typedAnswer: options.typedAnswer,
				skipped: options.revealed === true ? true : undefined,
				creditEarned: grade.earned,
				creditPossible: grade.possible,
			});

			await this.attempts.save(answered);

			return this.resultOf(
				answered,
				isCorrect,
				false,
				question,
				grade,
				options.typedAnswer,
				gradable,
			);
		});
	}

	private resultOf(
		attempt: AttemptEntity,
		isCorrect: boolean,
		alreadyAnswered: boolean,
		question: QuestionEntity,
		grade: AnswerGrade,
		typedAnswer: string | undefined,
		gradable: boolean,
	): Result {
		return {
			isCorrect,
			alreadyAnswered,
			explanation: question.explanation,
			acceptedAnswers: QuestionEntity.expectsTypedAnswer(question)
				? Answer.acceptedFor(question)
				: [],
			typedAnswer,
			nearMiss:
				isCorrect || typedAnswer === undefined
					? undefined
					: this.nearMissOf(question, typedAnswer),
			correctOptionIds: Answer.correctOptionsOf(question),
			question,
			nextQuestionId: AttemptEntity.currentQuestionId(attempt),
			score: AttemptEntity.score(attempt),
			credit: grade,
			gradable: gradable && isCorrect,
		};
	}

	private answerOf(
		question: QuestionEntity,
		selectedOptionIds: readonly QuestionOptionId[],
		typed: string | undefined,
	): Answer {
		if (QuestionEntity.expectsTypedAnswer(question)) {
			return Answer.text(typed ?? "");
		}

		if (question.type === QuestionType.Ordering) {
			return Answer.order(selectedOptionIds);
		}

		if (question.type === QuestionType.Matching) {
			return Answer.pairs(this.pairsOf(selectedOptionIds));
		}

		return Answer.options(selectedOptionIds);
	}

	private pairsOf(
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

	private nearMissOf(
		question: QuestionEntity,
		typed: string,
	): string | undefined {
		const candidate = normaliseForComparison(typed);

		return Answer.acceptedFor(question).find((accepted) =>
			isWithinOneEdit(candidate, normaliseForComparison(accepted)),
		);
	}

	private selectedIdsOf(
		question: QuestionEntity,
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
}
