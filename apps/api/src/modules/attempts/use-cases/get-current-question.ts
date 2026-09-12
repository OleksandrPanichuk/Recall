import { Injectable } from "@nestjs/common";
import { UseCase } from "@/core/use-case";
import {
	QuestionEntity,
	type QuizSetId,
	QuizzesRepository,
} from "@/modules/quizzes";
import { StudySettingsService } from "@/modules/study-settings";
import { AttemptEntity } from "../attempt.entity";
import { type QuizAttemptId } from "../attempt.entity.types";
import { type QuizAttemptStatus } from "../attempts.constants";
import { AttemptsRepository } from "../attempts.repository";
import { type AttemptOfUserCommand } from "./resume-quiz-attempt";

export type GetCurrentQuestionUseCaseOptions = AttemptOfUserCommand;

export interface CurrentQuestionView {
	readonly attemptId: QuizAttemptId;
	readonly quizSetId: QuizSetId;
	readonly quizSetTitle: string;
	readonly status: QuizAttemptStatus;
	readonly question?: QuestionEntity;
	readonly index: number;
	readonly total: number;
	readonly awaitingFinish: boolean;
	readonly shuffleOptions: boolean;
	readonly examMode: boolean;
}

type Options = GetCurrentQuestionUseCaseOptions;
type Result = CurrentQuestionView | undefined;

@Injectable()
export class GetCurrentQuestionUseCase extends UseCase<Options, Result> {
	constructor(
		private readonly attempts: AttemptsRepository,
		private readonly quizzes: QuizzesRepository,
		private readonly settingsService: StudySettingsService,
	) {
		super();
	}

	async execute(_options: Options): Promise<Result> {
		const attempt = await this.attempts.findActive();

		if (attempt === undefined) {
			return undefined;
		}

		const { settings } = await this.settingsService.resolve(attempt.quizSetId);
		const quizSet = await this.quizzes.findById(attempt.quizSetId);
		const questionId = AttemptEntity.currentQuestionId(attempt);
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
