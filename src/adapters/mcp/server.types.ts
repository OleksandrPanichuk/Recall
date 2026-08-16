import type { DeleteFolder } from "@/application/use-cases/folders/delete-folder";
import type { EnsureFolderPath } from "@/application/use-cases/folders/ensure-folder-path";
import type { ListFolderTree } from "@/application/use-cases/folders/list-folder-tree";
import type { RenameFolder } from "@/application/use-cases/folders/rename-folder";
import type { ResolveFolderPath } from "@/application/use-cases/folders/resolve-folder-path";
import type { AddQuestions } from "@/application/use-cases/quiz-sets/add-questions";
import type { AddVocabulary } from "@/application/use-cases/quiz-sets/add-vocabulary";
import type { ArchiveQuizSet } from "@/application/use-cases/quiz-sets/archive-quiz-set";
import type { CreateQuizSet } from "@/application/use-cases/quiz-sets/create-quiz-set";
import type { GetQuizSet } from "@/application/use-cases/quiz-sets/get-quiz-set";
import type { ListQuizSets } from "@/application/use-cases/quiz-sets/list-quiz-sets";
import type { ListVocabulary } from "@/application/use-cases/quiz-sets/list-vocabulary";
import type { MoveQuizSet } from "@/application/use-cases/quiz-sets/move-quiz-set";
import type { PublishQuizSet } from "@/application/use-cases/quiz-sets/publish-quiz-set";
import type { UpdateQuizSet } from "@/application/use-cases/quiz-sets/update-quiz-set";
import type { UpdateVocabulary } from "@/application/use-cases/quiz-sets/update-vocabulary";
import type { ResolveQuizSettings } from "@/application/use-cases/settings/resolve-quiz-settings";
import type { UpdateQuizSettings } from "@/application/use-cases/settings/update-quiz-settings";
import type { Logger } from "@/infrastructure/logging/logger.types";

export interface McpUseCases {
	readonly createQuizSet: CreateQuizSet;
	readonly updateQuizSet: UpdateQuizSet;
	readonly addQuestions: AddQuestions;
	readonly addVocabulary: AddVocabulary;
	readonly updateVocabulary: UpdateVocabulary;
	readonly listVocabulary: ListVocabulary;
	readonly resolveQuizSettings: ResolveQuizSettings;
	readonly updateQuizSettings: UpdateQuizSettings;
	readonly publishQuizSet: PublishQuizSet;
	readonly archiveQuizSet: ArchiveQuizSet;
	readonly getQuizSet: GetQuizSet;
	readonly listQuizSets: ListQuizSets;
	readonly moveQuizSet: MoveQuizSet;
	readonly ensureFolderPath: EnsureFolderPath;
	readonly resolveFolderPath: ResolveFolderPath;
	readonly renameFolder: RenameFolder;
	readonly deleteFolder: DeleteFolder;
	readonly listFolderTree: ListFolderTree;
}

export interface McpServerOptions {
	readonly logger?: Logger;
}
