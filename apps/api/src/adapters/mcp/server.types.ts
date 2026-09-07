import type { Logger } from "@recall/kit";
import type { GetInsightsUseCase } from "@/application/use-cases/analytics/get-insights";
import type { AbandonQuizAttemptUseCase } from "@/application/use-cases/attempts/abandon-quiz-attempt";
import type { AttachQuizUseCase } from "@/application/use-cases/folders/attach-quiz";
import type { BrowseFolderUseCase } from "@/application/use-cases/folders/browse-folder";
import type { AddVocabularyUseCase } from "@/application/use-cases/quiz-sets/add-vocabulary";
import type { ListVocabularyUseCase } from "@/application/use-cases/quiz-sets/list-vocabulary";
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
import {
	AddQuestionsUseCase,
	ArchiveQuizSetUseCase,
	CreateQuizSetUseCase,
	DeleteQuestionUseCase,
	GetQuizSetUseCase,
	ListQuizSetsUseCase,
	MoveQuizSetUseCase,
	PublishQuizSetUseCase,
	UpdateQuestionUseCase,
	UpdateQuizSetUseCase,
} from "@/modules/quizzes";

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
