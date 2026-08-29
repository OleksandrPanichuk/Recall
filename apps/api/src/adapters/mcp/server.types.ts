import type { Logger } from "@recall/kit";
import type { BrowseFolderUseCase } from "@/application/use-cases/folders/browse-folder";
import type { DeleteFolderUseCase } from "@/application/use-cases/folders/delete-folder";
import type { EnsureFolderPathUseCase } from "@/application/use-cases/folders/ensure-folder-path";
import type { ListFolderTreeUseCase } from "@/application/use-cases/folders/list-folder-tree";
import type { RenameFolderUseCase } from "@/application/use-cases/folders/rename-folder";
import type { ResolveFolderPathUseCase } from "@/application/use-cases/folders/resolve-folder-path";
import type { WriteSummaryUseCase } from "@/application/use-cases/folders/write-summary";
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
	readonly ensureFolderPath: EnsureFolderPathUseCase;
	readonly resolveFolderPath: ResolveFolderPathUseCase;
	readonly renameFolder: RenameFolderUseCase;
	readonly deleteFolder: DeleteFolderUseCase;
	readonly listFolderTree: ListFolderTreeUseCase;
	readonly browseFolder: BrowseFolderUseCase;
	readonly writeSummary: WriteSummaryUseCase;
	readonly updateQuestion: UpdateQuestionUseCase;
	readonly deleteQuestion: DeleteQuestionUseCase;
}

export interface McpServerOptions {
	readonly logger?: Logger;
}
