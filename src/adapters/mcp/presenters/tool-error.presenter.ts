import { FolderNotFoundError } from "@/application/use-cases/folders/create-folder";
import { FolderNotEmptyError } from "@/application/use-cases/folders/delete-folder";
import { FolderPathNotFoundError } from "@/application/use-cases/folders/resolve-folder-path";
import {
	EmptyQuestionBatchError,
	QuestionBatchTooLargeError,
} from "@/application/use-cases/quiz-sets/add-questions";
import { QuizSetNotFoundError } from "@/application/use-cases/quiz-sets/update-quiz-set";
import {
	DuplicateFolderNameError,
	FolderCycleError,
	FolderDepthError,
	FolderValidationError,
} from "@/domain/folder/folder.errors";
import {
	DuplicateQuestionError,
	EmptyQuizSetError,
	QuestionValidationError,
	QuizSetTransitionError,
	QuizSetValidationError,
} from "@/domain/quiz-set/quiz-set.errors";

export function describeError(error: unknown): string {
	if (error instanceof QuestionValidationError) {
		return `Invalid question: ${error.issues.join("; ")}`;
	}

	if (error instanceof QuizSetValidationError) {
		return `Invalid quiz set: ${error.issues.join("; ")}`;
	}

	if (error instanceof DuplicateQuestionError) {
		return "This batch repeats a question the set already contains. Re-read the set with quiz_get_set and send only the new questions.";
	}

	if (error instanceof EmptyQuizSetError) {
		return "A quiz set needs at least one question before it can be published.";
	}

	if (error instanceof QuizSetTransitionError) {
		return `${error.message}. Published content is immutable; create a new set instead.`;
	}

	if (error instanceof QuizSetNotFoundError) {
		return `Quiz set ${error.quizSetId} does not exist. Use quiz_list_sets to see the available ids.`;
	}

	if (error instanceof QuestionBatchTooLargeError) {
		return `${error.message}. Split the import into smaller batches.`;
	}

	if (error instanceof EmptyQuestionBatchError) {
		return "A batch must contain at least one question.";
	}

	if (error instanceof FolderPathNotFoundError) {
		return `${error.message}. Call quiz_list_folders to see the tree, or quiz_ensure_folder_path to create it.`;
	}

	if (error instanceof FolderNotFoundError) {
		return `${error.message}. Call quiz_list_folders to see the tree.`;
	}

	if (error instanceof FolderNotEmptyError) {
		return `${error.message}. Move or delete what is inside first — quiz_move_set files a set elsewhere.`;
	}

	if (error instanceof DuplicateFolderNameError) {
		return `${error.message}. Pick another name, or file into the existing folder.`;
	}

	if (error instanceof FolderDepthError) {
		return `${error.message}. Flatten the path — folders may not nest deeper than ${error.limit}.`;
	}

	if (error instanceof FolderCycleError) {
		return `${error.message}.`;
	}

	if (error instanceof FolderValidationError) {
		return `Invalid folder: ${error.issues.join("; ")}`;
	}

	return error instanceof Error
		? `Unexpected error: ${error.message}`
		: "Unexpected error.";
}
