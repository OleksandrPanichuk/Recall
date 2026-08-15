import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { describeQuizSet, ok } from "../presenters/tool-result.presenter";
import { quizSetIdShape } from "../schemas/quiz-set.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerGetSetTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_get_set",
		{
			title: "Read a quiz set",
			description:
				"Returns a set with every question and option, correct answers marked with *. Use this to review a draft before publishing.",
			inputSchema: quizSetIdShape,
		},
		async (args) =>
			runTool("quiz_get_set", args, async () => {
				const quizSet = await useCases.getQuizSet.execute({
					quizSetId: toQuizSetId(args.quizSetId),
				});

				return ok(describeQuizSet(quizSet), {
					quizSetId: quizSet.id,
					status: quizSet.status,
					questionCount: quizSet.questions.length,
				});
			}),
	);
}
