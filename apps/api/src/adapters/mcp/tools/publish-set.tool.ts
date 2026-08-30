import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { ok } from "../presenters/tool-result.presenter";
import { quizSetIdShape } from "../schemas/quiz-set.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerPublishSetTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_publish_set",
		{
			title: "Publish a quiz set",
			description:
				"Publishes a draft so it can be taken in Telegram. Requires at least one question. Publishing an already-published set is a no-op.",
			inputSchema: quizSetIdShape,
		},
		async (args) =>
			runTool("quiz_publish_set", args, async () => {
				await useCases.publishQuizSet.execute({
					quizSetId: toQuizSetId(args.quizSetId),
				});

				return ok(`Published quiz set ${args.quizSetId}.`, {
					quizSetId: args.quizSetId,
				});
			}),
	);
}
