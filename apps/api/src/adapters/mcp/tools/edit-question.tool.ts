import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QuestionOptionInput } from "@/application/use-cases/quiz-sets/add-questions";
import type { Difficulty } from "@/domain/quiz-set/question";
import { toQuestionId } from "@/domain/quiz-set/question";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { ok } from "../presenters/tool-result.presenter";
import {
	deleteQuestionShape,
	updateQuestionShape,
} from "../schemas/question-edit.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

interface ContentArgs {
	readonly options?: readonly QuestionOptionInput[];
	readonly acceptedAnswers?: readonly string[];
	readonly orderedItems?: readonly string[];
	readonly pairs?: readonly { left: string; right: string }[];
}

const accepted = (texts: readonly string[]): readonly QuestionOptionInput[] =>
	texts.map((text) => ({ text, isCorrect: true }));

function optionsFrom(
	args: ContentArgs,
): readonly QuestionOptionInput[] | undefined {
	if (args.pairs !== undefined) {
		return [
			...args.pairs.map((pair, index) => ({
				text: pair.left,
				isCorrect: true,
				matchKey: `p${index}`,
			})),
			...args.pairs.map((pair, index) => ({
				text: pair.right,
				isCorrect: true,
				matchKey: `p${index}`,
			})),
		];
	}

	if (args.acceptedAnswers !== undefined) {
		return accepted(args.acceptedAnswers);
	}

	if (args.orderedItems !== undefined) {
		return accepted(args.orderedItems);
	}

	return args.options;
}

export function registerEditQuestionTools(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_update_question",
		{
			title: "Fix one question",
			description:
				"Changes one question in place, keeping its id, so answering history and its repetition schedule survive. Works on a published set — that is where mistakes are found. Omitted fields keep their current value. Give the answers in the shape the question type uses: options for choice questions, acceptedAnswers for typed_answer and cloze, orderedItems for ordering, pairs for matching; passing the wrong shape is refused. The type itself cannot change: a different type is a different question, so delete it and add a new one. Adding an accepted answer is the fix for a learner who typed a correct synonym and was marked wrong.",
			inputSchema: updateQuestionShape,
		},
		async (args) =>
			runTool("quiz_update_question", args, async () => {
				const result = await useCases.updateQuestion.execute({
					quizSetId: toQuizSetId(args.quizSetId),
					questionId: toQuestionId(args.questionId),
					prompt: args.prompt,
					difficulty: args.difficulty as Difficulty | undefined,
					explanation: args.explanation,
					sourceReference: args.sourceReference,
					topic: args.topic,
					hint: args.hint,
					options: optionsFrom(args),
				});

				return ok(
					`Updated ${result.questionId} — ${result.optionCount} answers now accepted.`,
					{
						questionId: String(result.questionId),
						prompt: result.prompt,
						optionCount: result.optionCount,
					},
				);
			}),
	);

	server.registerTool(
		"quiz_delete_question",
		{
			title: "Remove a question",
			description:
				"Deletes one question from a set. Refused when anyone has already answered it, because the answers and its repetition schedule would go with it — edit the question instead. Also refused when it is the last question, since a set cannot be empty. The remaining questions keep their order and are renumbered.",
			inputSchema: deleteQuestionShape,
		},
		async (args) =>
			runTool("quiz_delete_question", args, async () => {
				const result = await useCases.deleteQuestion.execute({
					quizSetId: toQuizSetId(args.quizSetId),
					questionId: toQuestionId(args.questionId),
				});

				return ok(
					`Removed ${result.questionId}; ${result.remaining} questions left.`,
					{
						questionId: String(result.questionId),
						remaining: result.remaining,
					},
				);
			}),
	);
}
