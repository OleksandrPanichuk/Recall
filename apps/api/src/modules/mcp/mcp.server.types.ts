import { Injectable } from "@nestjs/common";
import type { Logger } from "@recall/kit";
import { AbandonQuizAttemptUseCase } from "@/modules/attempts";
import { GetInsightsUseCase } from "@/modules/insights";
import {
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

@Injectable()
export class McpUseCases {
	constructor(
		public readonly createQuizSet: CreateQuizSetUseCase,
		public readonly updateQuizSet: UpdateQuizSetUseCase,
		public readonly addQuestions: AddQuestionsUseCase,
		public readonly addVocabulary: AddVocabularyUseCase,
		public readonly updateVocabulary: UpdateVocabularyUseCase,
		public readonly listVocabulary: ListVocabularyUseCase,
		public readonly resolveQuizSettings: ResolveQuizSettingsUseCase,
		public readonly updateQuizSettings: UpdateQuizSettingsUseCase,
		public readonly publishQuizSet: PublishQuizSetUseCase,
		public readonly archiveQuizSet: ArchiveQuizSetUseCase,
		public readonly getQuizSet: GetQuizSetUseCase,
		public readonly listQuizSets: ListQuizSetsUseCase,
		public readonly moveQuizSet: MoveQuizSetUseCase,
		public readonly ensureFolderPath: EnsurePagePathUseCase,
		public readonly resolveFolderPath: ResolvePagePathUseCase,
		public readonly renameFolder: RenamePageUseCase,
		public readonly deleteFolder: DeletePageUseCase,
		public readonly listFolderTree: ListPageTreeUseCase,
		public readonly browseFolder: BrowseFolderUseCase,
		public readonly writeSummary: WriteSummaryUseCase,
		public readonly listRevisions: ListPageRevisionsUseCase,
		public readonly searchPages: SearchPagesUseCase,
		public readonly setPageIcon: SetPageIconUseCase,
		public readonly getInsights: GetInsightsUseCase,
		public readonly abandonQuizAttempt: AbandonQuizAttemptUseCase,
		public readonly attachQuiz: AttachQuizUseCase,
		public readonly detachQuiz: DetachQuizUseCase,
		public readonly updateQuestion: UpdateQuestionUseCase,
		public readonly deleteQuestion: DeleteQuestionUseCase,
	) {}
}

export interface McpServerOptions {
	readonly logger?: Logger;
}
