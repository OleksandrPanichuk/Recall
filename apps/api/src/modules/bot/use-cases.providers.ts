import type { Provider } from "@nestjs/common";
import type { ApplicationDependencies } from "@/application/use-case";
import { GetInsightsUseCase } from "@/application/use-cases/analytics/get-insights";
import { AbandonQuizAttemptUseCase } from "@/application/use-cases/attempts/abandon-quiz-attempt";
import { AnswerQuestionUseCase } from "@/application/use-cases/attempts/answer-question";
import { FinishQuizAttemptUseCase } from "@/application/use-cases/attempts/finish-quiz-attempt";
import { GetCurrentQuestionUseCase } from "@/application/use-cases/attempts/get-current-question";
import { StartQuizAttemptUseCase } from "@/application/use-cases/attempts/start-quiz-attempt";
import { BrowseFolderUseCase } from "@/application/use-cases/folders/browse-folder";
import { CreateFolderUseCase } from "@/application/use-cases/folders/create-folder";
import { DeleteFolderUseCase } from "@/application/use-cases/folders/delete-folder";
import { ListFolderTreeUseCase } from "@/application/use-cases/folders/list-folder-tree";
import { RenameFolderUseCase } from "@/application/use-cases/folders/rename-folder";
import { SearchPagesUseCase } from "@/application/use-cases/folders/search-pages";
import { SetPageIconUseCase } from "@/application/use-cases/folders/set-page-icon";
import { WriteSummaryUseCase } from "@/application/use-cases/folders/write-summary";
import { StartPracticeSessionUseCase } from "@/application/use-cases/practice/start-practice-session";
import { ListDueRepetitionsUseCase } from "@/application/use-cases/repetition/list-due-repetitions";
import { ListLeechesUseCase } from "@/application/use-cases/repetition/list-leeches";
import { ResolveQuizSettingsUseCase } from "@/application/use-cases/settings/resolve-quiz-settings";
import { UpdateQuizSettingsUseCase } from "@/application/use-cases/settings/update-quiz-settings";
import { GetAttemptDetailUseCase } from "@/application/use-cases/statistics/get-attempt-detail";
import { GetQuizStatisticsUseCase } from "@/application/use-cases/statistics/get-quiz-statistics";
import { USE_CASE_DEPENDENCIES } from "../shared/database/tokens";

type Constructor = new (dependencies: ApplicationDependencies) => unknown;

const fromDependencies = (useCase: Constructor): Provider => ({
	provide: useCase,
	inject: [USE_CASE_DEPENDENCIES],
	useFactory: (dependencies: ApplicationDependencies) =>
		new useCase(dependencies),
});

export const botUseCases: Provider[] = [
	BrowseFolderUseCase,
	WriteSummaryUseCase,
	SearchPagesUseCase,
	CreateFolderUseCase,
	RenameFolderUseCase,
	SetPageIconUseCase,
	DeleteFolderUseCase,
	ListFolderTreeUseCase,
	GetInsightsUseCase,
	AbandonQuizAttemptUseCase,
	StartQuizAttemptUseCase,
	StartPracticeSessionUseCase,
	GetCurrentQuestionUseCase,
	AnswerQuestionUseCase,
	FinishQuizAttemptUseCase,
	GetQuizStatisticsUseCase,
	GetAttemptDetailUseCase,
	ListDueRepetitionsUseCase,
	ListLeechesUseCase,
	ResolveQuizSettingsUseCase,
	UpdateQuizSettingsUseCase,
].map((useCase) => fromDependencies(useCase as unknown as Constructor));
