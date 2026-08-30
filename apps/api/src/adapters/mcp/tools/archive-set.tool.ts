import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { ok } from "../presenters/tool-result.presenter";
import { quizSetIdShape } from "../schemas/quiz-set.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerArchiveSetTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_archive_set",
		{
			title: "Archive a quiz set",
			description:
				"Archives a set so it no longer appears in the Telegram menu. Existing attempt history is kept.",
			inputSchema: quizSetIdShape,
		},
		async (args) =>
			runTool("quiz_archive_set", args, async () => {
				await useCases.archiveQuizSet.execute({
					quizSetId: toQuizSetId(args.quizSetId),
				});

				return ok(`Archived quiz set ${args.quizSetId}.`, {
					quizSetId: args.quizSetId,
				});
			}),
	);
}
