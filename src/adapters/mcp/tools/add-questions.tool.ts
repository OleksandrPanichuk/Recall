import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { ok } from "../presenters/tool-result.presenter";
import { toQuestionInput } from "../schemas/question-input";
import { addQuestionsShape } from "../schemas/quiz-set.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerAddQuestionsTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_add_questions",
		{
			title: "Add questions to a draft",
			description:
				"Appends a batch of questions to a draft set. The whole batch is applied atomically. Re-sending an identical batch is a safe no-op, so a retry after an uncertain response cannot duplicate content.",
			inputSchema: addQuestionsShape,
		},
		async (args) =>
			runTool("quiz_add_questions", args, async () => {
				const result = await useCases.addQuestions.execute({
					quizSetId: toQuizSetId(args.quizSetId),
					questions: args.questions.map(toQuestionInput),
				});

				if (result.alreadyPresent) {
					return ok(
						`No change: all ${args.questions.length} questions are already in ${args.quizSetId}.`,
						{ quizSetId: args.quizSetId, addedQuestionIds: [] },
					);
				}

				return ok(
					`Added ${result.addedQuestionIds.length} questions to ${args.quizSetId}. The set is still a DRAFT and will not appear in Telegram until you call quiz_publish_set.`,
					{
						quizSetId: args.quizSetId,
						addedQuestionIds: [...result.addedQuestionIds],
						status: "draft",
						nextStep: "quiz_publish_set",
					},
				);
			}),
	);
}
