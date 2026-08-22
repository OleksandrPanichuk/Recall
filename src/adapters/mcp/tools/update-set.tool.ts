import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { ok } from "../presenters/tool-result.presenter";
import { updateSetShape } from "../schemas/quiz-set.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerUpdateSetTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_update_set",
		{
			title: "Update set metadata",
			description:
				"Changes the metadata of a draft or published set. Omitted fields keep their current value; an empty string clears an optional one. An archived set is read-only.",
			inputSchema: updateSetShape,
		},
		async (args) =>
			runTool("quiz_update_set", args, async () => {
				await useCases.updateQuizSet.execute({
					...args,
					quizSetId: toQuizSetId(args.quizSetId),
				});

				return ok(`Updated quiz set ${args.quizSetId}.`, {
					quizSetId: args.quizSetId,
				});
			}),
	);
}
