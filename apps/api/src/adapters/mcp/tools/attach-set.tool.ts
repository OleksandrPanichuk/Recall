import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { ok } from "../presenters/tool-result.presenter";
import { attachSetShape } from "../schemas/folder.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerAttachSetTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_attach_set",
		{
			title: "Show a quiz under a page",
			description:
				"Displays an existing quiz beneath the given page's summary without moving it. Use this when the quiz is filed elsewhere — a quiz in Books/JS-basics can be shown under Programming/Books/JS/Chapter 1.",
			inputSchema: attachSetShape,
		},
		async (args) =>
			runTool("quiz_attach_set", args, async () => {
				const { folderId } = await useCases.ensureFolderPath.execute({
					path: args.path,
				});
				const attached = await useCases.attachQuiz.execute({
					folderId,
					quizSetId: toQuizSetId(args.quizSetId),
				});

				return ok(
					`"${attached.title}" is now shown under ${args.path.join(" / ")}.`,
					{
						folderId: String(attached.folderId),
						quizSetId: String(attached.quizSetId),
						title: attached.title,
					},
				);
			}),
	);

	server.registerTool(
		"quiz_detach_set",
		{
			title: "Stop showing a quiz under a page",
			description:
				"Removes a quiz from the given page's list without deleting the quiz or moving it out of the folder it is filed in.",
			inputSchema: attachSetShape,
		},
		async (args) =>
			runTool("quiz_detach_set", args, async () => {
				const { folderId } = await useCases.resolveFolderPath.execute({
					path: args.path,
				});
				const detached = await useCases.detachQuiz.execute({
					folderId,
					quizSetId: toQuizSetId(args.quizSetId),
				});

				return ok(`No longer shown under ${args.path.join(" / ")}.`, {
					folderId: String(detached.folderId),
					quizSetId: String(detached.quizSetId),
				});
			}),
	);
}
