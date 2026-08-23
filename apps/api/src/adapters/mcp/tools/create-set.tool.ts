import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ok } from "../presenters/tool-result.presenter";
import { createSetShape } from "../schemas/quiz-set.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerCreateSetTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_create_set",
		{
			title: "Create a draft quiz set",
			description:
				"Creates an empty draft quiz set and returns its id. Add questions with quiz_add_questions, then publish with quiz_publish_set.",
			inputSchema: createSetShape,
		},
		async (args) =>
			runTool("quiz_create_set", args, async () => {
				const { folderPath, ...metadata } = args;
				const folder =
					folderPath === undefined
						? undefined
						: await useCases.ensureFolderPath.execute({ path: folderPath });
				const { quizSetId } = await useCases.createQuizSet.execute({
					...metadata,
					folderId: folder?.folderId,
				});

				return ok(
					folderPath === undefined
						? `Created draft quiz set ${quizSetId} — "${args.title}".`
						: `Created draft quiz set ${quizSetId} — "${args.title}" in ${folderPath.join(" / ")}.`,
					{ quizSetId, folderId: folder?.folderId },
				);
			}),
	);
}
