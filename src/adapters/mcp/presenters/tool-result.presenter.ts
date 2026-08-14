import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { QuizSetSummary } from "@/application/ports/repositories/quiz-set.repository";
import { FolderNotFoundError } from "@/application/use-cases/folders/create-folder";
import { FolderNotEmptyError } from "@/application/use-cases/folders/delete-folder";
import type { FolderTreeNode } from "@/application/use-cases/folders/list-folder-tree";
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
import type { QuizSet } from "@/domain/quiz-set/quiz-set";
import {
	DuplicateQuestionError,
	EmptyQuizSetError,
	QuestionValidationError,
	QuizSetTransitionError,
	QuizSetValidationError,
} from "@/domain/quiz-set/quiz-set.errors";

export type ToolResult = CallToolResult;

export function ok(
	summary: string,
	structured: Record<string, unknown> = {},
): ToolResult {
	return {
		content: [{ type: "text", text: summary }],
		structuredContent: structured,
	};
}

export function failure(error: unknown): ToolResult {
	return {
		content: [{ type: "text", text: describe(error) }],
		isError: true,
	};
}

function describe(error: unknown): string {
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

export function describeQuizSet(quizSet: QuizSet): string {
	const questions = quizSet.questions
		.map(
			(question, index) =>
				`${index + 1}. [${question.type}/${question.difficulty}${question.topic === undefined ? "" : `/${question.topic}`}] ${question.prompt}\n   ${question.options
					.map((option) => `${option.isCorrect ? "*" : "-"} ${option.text}`)
					.join("\n   ")}`,
		)
		.join("\n");

	return [
		`${quizSet.title} (${quizSet.id})`,
		`status: ${quizSet.status}, language: ${quizSet.language}, questions: ${quizSet.questions.length}`,
		quizSet.tags.length === 0 ? undefined : `tags: ${quizSet.tags.join(", ")}`,
		quizSet.source === undefined ? undefined : `source: ${quizSet.source}`,
		questions.length === 0 ? "no questions yet" : `\n${questions}`,
	]
		.filter((line) => line !== undefined)
		.join("\n");
}

export function describeSummaries(sets: readonly QuizSetSummary[]): string {
	if (sets.length === 0) {
		return "No quiz sets yet.";
	}

	return sets
		.map(
			(set) =>
				`${set.id} — ${set.title} [${set.status}] ${set.questionCount} questions`,
		)
		.join("\n");
}

const MAX_TREE_LINES = 200;

export function describeFolderTree(nodes: readonly FolderTreeNode[]): string {
	if (nodes.length === 0) {
		return "No folders yet. Create one with quiz_ensure_folder_path.";
	}

	const lines = nodes
		.slice(0, MAX_TREE_LINES)
		.map(
			(node) =>
				`${"  ".repeat(node.depth)}${node.name} (${node.setCount} ${node.setCount === 1 ? "set" : "sets"})`,
		);

	if (nodes.length > MAX_TREE_LINES) {
		lines.push(`… and ${nodes.length - MAX_TREE_LINES} more folder(s).`);
	}

	return lines.join("\n");
}
