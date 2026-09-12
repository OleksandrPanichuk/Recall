import {
	AbandonQuizAttemptUseCase,
	AnswerQuestionUseCase,
	FinishQuizAttemptUseCase,
	GetCurrentQuestionUseCase,
	PauseQuizAttemptUseCase,
	RateRecallUseCase,
	ResumeQuizAttemptUseCase,
	StartQuizAttemptUseCase,
} from "@/modules/attempts";
import { StudySettingsService } from "@/modules/study-settings";
import type { MemoryContext } from "./memory.fixture";

export interface AttemptsUseCases {
	readonly abandonQuizAttempt: AbandonQuizAttemptUseCase;
	readonly answerQuestion: AnswerQuestionUseCase;
	readonly finishQuizAttempt: FinishQuizAttemptUseCase;
	readonly getCurrentQuestion: GetCurrentQuestionUseCase;
	readonly pauseQuizAttempt: PauseQuizAttemptUseCase;
	readonly rateRecall: RateRecallUseCase;
	readonly resumeQuizAttempt: ResumeQuizAttemptUseCase;
	readonly startQuizAttempt: StartQuizAttemptUseCase;
}

export function attemptsOver(context: MemoryContext): AttemptsUseCases {
	const { scope, transaction, clock, idGenerator } = context;
	const attempts = scope.attempts;
	const quizzes = scope.quizzes;
	const reviews = scope.reviews;
	const settings = new StudySettingsService(reviews);
	const timezone = { name: () => context.timezone };

	return {
		abandonQuizAttempt: new AbandonQuizAttemptUseCase(attempts, transaction),
		answerQuestion: new AnswerQuestionUseCase(
			attempts,
			quizzes,
			settings,
			transaction,
			clock,
		),
		finishQuizAttempt: new FinishQuizAttemptUseCase(
			attempts,
			reviews,
			settings,
			transaction,
			clock,
			timezone,
		),
		getCurrentQuestion: new GetCurrentQuestionUseCase(
			attempts,
			quizzes,
			settings,
		),
		pauseQuizAttempt: new PauseQuizAttemptUseCase(attempts, transaction, clock),
		rateRecall: new RateRecallUseCase(attempts, transaction, clock),
		resumeQuizAttempt: new ResumeQuizAttemptUseCase(
			attempts,
			transaction,
			clock,
		),
		startQuizAttempt: new StartQuizAttemptUseCase(
			attempts,
			quizzes,
			reviews,
			settings,
			transaction,
			clock,
			idGenerator,
		),
	};
}
