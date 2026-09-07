import type { Provider } from "@nestjs/common";
import { USE_CASE_DEPENDENCIES } from "@/application/tokens";
import type { ApplicationDependencies } from "@/application/use-case";
import { GetInsightsUseCase } from "@/application/use-cases/analytics/get-insights";
import { AbandonQuizAttemptUseCase } from "@/application/use-cases/attempts/abandon-quiz-attempt";
import { AnswerQuestionUseCase } from "@/application/use-cases/attempts/answer-question";
import { FinishQuizAttemptUseCase } from "@/application/use-cases/attempts/finish-quiz-attempt";
import { GetCurrentQuestionUseCase } from "@/application/use-cases/attempts/get-current-question";
import { RateRecallUseCase } from "@/application/use-cases/attempts/rate-recall";
import {
	PauseQuizAttemptUseCase,
	ResumeQuizAttemptUseCase,
} from "@/application/use-cases/attempts/resume-quiz-attempt";
import { StartQuizAttemptUseCase } from "@/application/use-cases/attempts/start-quiz-attempt";
import { AttachQuizUseCase } from "@/application/use-cases/folders/attach-quiz";
import { BrowseFolderUseCase } from "@/application/use-cases/folders/browse-folder";
import { StartPracticeSessionUseCase } from "@/application/use-cases/practice/start-practice-session";
import { GetAttemptDetailUseCase } from "@/application/use-cases/statistics/get-attempt-detail";
import { GetQuizStatisticsUseCase } from "@/application/use-cases/statistics/get-quiz-statistics";

type Constructor = new (dependencies: ApplicationDependencies) => unknown;

const fromDependencies = (useCase: Constructor): Provider => ({
	provide: useCase,
	inject: [USE_CASE_DEPENDENCIES],
	useFactory: (dependencies: ApplicationDependencies) =>
		new useCase(dependencies),
});

export const botUseCases: Provider[] = [
	AttachQuizUseCase,
	BrowseFolderUseCase,
	GetInsightsUseCase,
	AbandonQuizAttemptUseCase,
	StartQuizAttemptUseCase,
	StartPracticeSessionUseCase,
	GetCurrentQuestionUseCase,
	AnswerQuestionUseCase,
	FinishQuizAttemptUseCase,
	PauseQuizAttemptUseCase,
	ResumeQuizAttemptUseCase,
	RateRecallUseCase,
	GetQuizStatisticsUseCase,
	GetAttemptDetailUseCase,
].map((useCase) => fromDependencies(useCase as unknown as Constructor));
