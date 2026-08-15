import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { ok } from "../presenters/tool-result.presenter";
import { moveSetShape } from "../schemas/folder.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerMoveSetTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_move_set",
		{
			title: "File a quiz set",
			description:
				"Files a set into a folder path, creating the path if it does not exist. Omit folderPath to return the set to the root. Works on published sets — filing is not content.",
			inputSchema: moveSetShape,
		},
		async (args) =>
			runTool("quiz_move_set", args, async () => {
				await useCases.getQuizSet.execute({
					quizSetId: toQuizSetId(args.quizSetId),
				});

				const folder =
					args.folderPath === undefined
						? undefined
						: await useCases.ensureFolderPath.execute({
								path: args.folderPath,
							});

				await useCases.moveQuizSet.execute({
					quizSetId: toQuizSetId(args.quizSetId),
					folderId: folder?.folderId,
				});

				return ok(
					args.folderPath === undefined
						? `Moved ${args.quizSetId} back to the root.`
						: `Moved ${args.quizSetId} into ${args.folderPath.join(" / ")}.`,
					{ quizSetId: args.quizSetId, folderId: folder?.folderId },
				);
			}),
	);
}
