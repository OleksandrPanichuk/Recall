import type { Logger } from "@recall/kit";
import type { AbandonQuizAttemptUseCase } from "@/modules/attempts";
import type { GetInsightsUseCase } from "@/modules/insights";
import type {
	AttachQuizUseCase,
	BrowseFolderUseCase,
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
import {
	ResolveQuizSettingsUseCase,
	UpdateQuizSettingsUseCase,
} from "@/modules/study-settings";
import {
	AddVocabularyUseCase,
	ListVocabularyUseCase,
	UpdateVocabularyUseCase,
} from "@/modules/vocabulary";

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
