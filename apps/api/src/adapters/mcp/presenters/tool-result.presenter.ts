import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { QuizSummary } from "@/application/ports/repositories/quiz.repository";
import type { FolderTreeNode } from "@/application/use-cases/folders/list-folder-tree";
import type { QuizSet } from "@/domain/quiz-set/quiz-set";
import { describeError } from "./tool-error.presenter";

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
		content: [{ type: "text", text: describeError(error) }],
		isError: true,
	};
}

export function describeQuizSet(quizSet: QuizSet): string {
	const questions = quizSet.questions
		.map(
			(question, index) =>
				`${index + 1}. ${question.id} [${question.type}/${question.difficulty}${question.topic === undefined ? "" : `/${question.topic}`}] ${question.prompt}\n   ${question.options
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

export function describeSummaries(sets: readonly QuizSummary[]): string {
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
				`${"  ".repeat(node.depth)}${node.name} (${node.setCount} ${node.setCount === 1 ? "set" : "sets"}${node.unpublishedCount === 0 ? "" : `, ${node.unpublishedCount} unpublished`})`,
		);

	if (nodes.length > MAX_TREE_LINES) {
		lines.push(`… and ${nodes.length - MAX_TREE_LINES} more folder(s).`);
	}

	return lines.join("\n");
}
