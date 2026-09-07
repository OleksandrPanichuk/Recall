import type { Logger } from "@recall/kit";
import type { GetInsightsUseCase } from "@/application/use-cases/analytics/get-insights";
import type { AbandonQuizAttemptUseCase } from "@/application/use-cases/attempts/abandon-quiz-attempt";
import type { AttachQuizUseCase } from "@/application/use-cases/folders/attach-quiz";
import type { BrowseFolderUseCase } from "@/application/use-cases/folders/browse-folder";
import type { AddQuestionsUseCase } from "@/application/use-cases/quiz-sets/add-questions";
import type { AddVocabularyUseCase } from "@/application/use-cases/quiz-sets/add-vocabulary";
import type { ArchiveQuizSetUseCase } from "@/application/use-cases/quiz-sets/archive-quiz-set";
import type { CreateQuizSetUseCase } from "@/application/use-cases/quiz-sets/create-quiz-set";
import type { DeleteQuestionUseCase } from "@/application/use-cases/quiz-sets/delete-question";
import type { GetQuizSetUseCase } from "@/application/use-cases/quiz-sets/get-quiz-set";
import type { ListQuizSetsUseCase } from "@/application/use-cases/quiz-sets/list-quiz-sets";
import type { ListVocabularyUseCase } from "@/application/use-cases/quiz-sets/list-vocabulary";
import type { MoveQuizSetUseCase } from "@/application/use-cases/quiz-sets/move-quiz-set";
import type { PublishQuizSetUseCase } from "@/application/use-cases/quiz-sets/publish-quiz-set";
import type { UpdateQuestionUseCase } from "@/application/use-cases/quiz-sets/update-question";
import type { UpdateQuizSetUseCase } from "@/application/use-cases/quiz-sets/update-quiz-set";
import type { UpdateVocabularyUseCase } from "@/application/use-cases/quiz-sets/update-vocabulary";
import type { ResolveQuizSettingsUseCase } from "@/application/use-cases/settings/resolve-quiz-settings";
import type { UpdateQuizSettingsUseCase } from "@/application/use-cases/settings/update-quiz-settings";
import type {
	DeletePageUseCase,
	DetachQuizUseCase,
	EnsurePagePathUseCase,
	ListPageRevisionsUseCase,
	ListPageTreeUseCase,
	RenamePageUseCase,
	ResolvePagePathUseCase,
	SearchPagesUseCase,
	SetPageIconUseCase,
	WriteSummaryUseCase,
} from "@/modules/pages";

export interface McpUseCases {
	readonly createQuizSet: CreateQuizSetUseCase;
	readonly updateQuizSet: UpdateQuizSetUseCase;
	readonly addQuestions: AddQuestionsUseCase;
	readonly addVocabulary: AddVocabularyUseCase;
	readonly updateVocabulary: UpdateVocabularyUseCase;
	readonly listVocabulary: ListVocabularyUseCase;
	readonly resolveQuizSettings: ResolveQuizSettingsUseCase;
	readonly updateQuizSettings: UpdateQuizSettingsUseCase;
	readonly publishQuizSet: PublishQuizSetUseCase;
	readonly archiveQuizSet: ArchiveQuizSetUseCase;
	readonly getQuizSet: GetQuizSetUseCase;
	readonly listQuizSets: ListQuizSetsUseCase;
	readonly moveQuizSet: MoveQuizSetUseCase;
	readonly ensureFolderPath: EnsurePagePathUseCase;
	readonly resolveFolderPath: ResolvePagePathUseCase;
	readonly renameFolder: RenamePageUseCase;
	readonly deleteFolder: DeletePageUseCase;
	readonly listFolderTree: ListPageTreeUseCase;
	readonly browseFolder: BrowseFolderUseCase;
	readonly writeSummary: WriteSummaryUseCase;
	readonly listRevisions: ListPageRevisionsUseCase;
	readonly searchPages: SearchPagesUseCase;
	readonly setPageIcon: SetPageIconUseCase;
	readonly getInsights: GetInsightsUseCase;
	readonly abandonQuizAttempt: AbandonQuizAttemptUseCase;
	readonly attachQuiz: AttachQuizUseCase;
	readonly detachQuiz: DetachQuizUseCase;
	readonly updateQuestion: UpdateQuestionUseCase;
	readonly deleteQuestion: DeleteQuestionUseCase;
}

export interface McpServerOptions {
	readonly logger?: Logger;
}
