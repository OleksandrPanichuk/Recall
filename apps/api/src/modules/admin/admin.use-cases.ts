import { Injectable } from "@nestjs/common";
import { GetInsightsUseCase } from "@/modules/insights";
import {
	CreatePageUseCase,
	DeletePageUseCase,
	ListPageTreeUseCase,
	MovePageUseCase,
	RenamePageUseCase,
} from "@/modules/pages";
import {
	AddQuestionsUseCase,
	ArchiveQuizSetUseCase,
	CreateQuizSetUseCase,
	DeleteQuestionUseCase,
	GetQuizSetUseCase,
	ListQuestionsUseCase,
	ListQuizSetsUseCase,
	MoveQuizSetUseCase,
	PublishQuizSetUseCase,
	UpdateQuestionUseCase,
	UpdateQuizSetUseCase,
} from "@/modules/quizzes";
import {
	ListDueRepetitionsUseCase,
	ListLeechesUseCase,
} from "@/modules/scheduling";
import { GetQuizStatisticsUseCase } from "@/modules/statistics";
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
export class AdminUseCases {
	constructor(
		public readonly addQuestions: AddQuestionsUseCase,
		public readonly addVocabulary: AddVocabularyUseCase,
		public readonly archiveQuizSet: ArchiveQuizSetUseCase,
		public readonly createFolder: CreatePageUseCase,
		public readonly createQuizSet: CreateQuizSetUseCase,
		public readonly deleteFolder: DeletePageUseCase,
		public readonly deleteQuestion: DeleteQuestionUseCase,
		public readonly getQuizSet: GetQuizSetUseCase,
		public readonly getQuizStatistics: GetQuizStatisticsUseCase,
		public readonly listDueRepetitions: ListDueRepetitionsUseCase,
		public readonly listFolderTree: ListPageTreeUseCase,
		public readonly listLeeches: ListLeechesUseCase,
		public readonly listQuestions: ListQuestionsUseCase,
		public readonly listQuizSets: ListQuizSetsUseCase,
		public readonly listVocabulary: ListVocabularyUseCase,
		public readonly moveFolder: MovePageUseCase,
		public readonly moveQuizSet: MoveQuizSetUseCase,
		public readonly publishQuizSet: PublishQuizSetUseCase,
		public readonly renameFolder: RenamePageUseCase,
		public readonly resolveQuizSettings: ResolveQuizSettingsUseCase,
		public readonly updateQuestion: UpdateQuestionUseCase,
		public readonly updateQuizSet: UpdateQuizSetUseCase,
		public readonly updateQuizSettings: UpdateQuizSettingsUseCase,
		public readonly updateVocabulary: UpdateVocabularyUseCase,
		public readonly getInsights: GetInsightsUseCase,
	) {}
}
