import type { Provider } from "@nestjs/common";
import { USE_CASE_DEPENDENCIES } from "@/application/tokens";
import type { ApplicationDependencies } from "@/application/use-case";
import { GetInsightsUseCase } from "@/application/use-cases/analytics/get-insights";
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
	StartPracticeSessionUseCase,
	GetQuizStatisticsUseCase,
	GetAttemptDetailUseCase,
].map((useCase) => fromDependencies(useCase as unknown as Constructor));
