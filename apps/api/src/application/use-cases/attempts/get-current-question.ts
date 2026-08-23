import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";
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
	readonly examMode: boolean;
}

export type GetCurrentQuestionDependencies = ApplicationDependencies;

export class GetCurrentQuestionUseCase
	implements
		UseCase<Command<AttemptOfUserCommand>, CurrentQuestionView | undefined>
{
	private readonly scope: RepositoryScope;

	constructor(dependencies: GetCurrentQuestionDependencies) {
		this.scope = dependencies.scope;
	}

	async execute(
		request: Command<AttemptOfUserCommand>,
	): Promise<CurrentQuestionView | undefined> {
		const { quizzes, attempts, reviews } = this.scope;
		const attempt = await attempts.findActiveFor(request.telegramUserId);

		if (attempt === undefined) {
			return undefined;
		}

		const { settings } = await resolveWithSource(reviews, attempt.quizSetId);
		const quizSet = await quizzes.findById(attempt.quizSetId);
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
			shuffleOptions: settings.shuffleOptions,
			examMode: settings.examMode,
		};
	}
}
