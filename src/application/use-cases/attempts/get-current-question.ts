import type { QuizAttemptRepository } from "@/application/ports/repositories/quiz-attempt.repository";
import type { QuizSetRepository } from "@/application/ports/repositories/quiz-set.repository";
import type { RepetitionRepository } from "@/application/ports/repositories/repetition.repository";
import type { Command, UseCase } from "@/application/use-case";
import {
	currentQuestionId,
	type QuizAttemptId,
	type QuizAttemptStatus,
} from "@/domain/quiz-attempt/quiz-attempt";
import type { Question } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import { resolveWithSource } from "../settings/resolve-quiz-settings";
import type { AttemptOfUserCommand } from "./resume-quiz-attempt";

export interface CurrentQuestionView {
	readonly attemptId: QuizAttemptId;
	readonly quizSetId: QuizSetId;
	readonly quizSetTitle: string;
	readonly status: QuizAttemptStatus;
	readonly question?: Question;
	readonly index: number;
	readonly total: number;
	readonly awaitingFinish: boolean;
	readonly shuffleOptions: boolean;
}

export interface GetCurrentQuestionDependencies {
	readonly quizSets: QuizSetRepository;
	readonly attempts: QuizAttemptRepository;
	readonly repetition: RepetitionRepository;
}

export class GetCurrentQuestion
	implements
		UseCase<Command<AttemptOfUserCommand>, CurrentQuestionView | undefined>
{
	private readonly quizSets: QuizSetRepository;
	private readonly attempts: QuizAttemptRepository;
	private readonly repetition: RepetitionRepository;

	constructor(dependencies: GetCurrentQuestionDependencies) {
		this.quizSets = dependencies.quizSets;
		this.attempts = dependencies.attempts;
		this.repetition = dependencies.repetition;
	}

	async execute(
		request: Command<AttemptOfUserCommand>,
	): Promise<CurrentQuestionView | undefined> {
		const attempt = this.attempts.findActiveByUser(request.telegramUserId);

		if (attempt === undefined) {
			return undefined;
		}

		const quizSet = this.quizSets.findById(attempt.quizSetId);
		const questionId = currentQuestionId(attempt);
		const question =
			questionId === undefined
				? undefined
				: quizSet?.questions.find((candidate) => candidate.id === questionId);

		return {
			attemptId: attempt.id,
			quizSetId: attempt.quizSetId,
			quizSetTitle: quizSet?.title ?? "",
			status: attempt.status,
			question,
			index: attempt.responses.length,
			total: attempt.questionIds.length,
			awaitingFinish: question === undefined,
			shuffleOptions: resolveWithSource(this.repetition, attempt.quizSetId)
				.settings.shuffleOptions,
		};
	}
}
