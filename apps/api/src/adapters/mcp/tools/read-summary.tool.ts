import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { QuizSummary } from "@/application/ports/repositories/quiz.repository";
import { ok } from "../presenters/tool-result.presenter";
import { readSummaryShape } from "../schemas/folder.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

const summaryOf = (set: QuizSummary) => ({
	id: String(set.id),
	title: set.title,
	questionCount: set.questionCount,
});

export function registerReadSummaryTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_read_summary",
		{
			title: "Read a page",
			description:
				"Returns the summary of the page at the given path, the pages nested inside it, and the quizzes filed under it.",
			inputSchema: readSummaryShape,
		},
		async (args) =>
			runTool("quiz_read_summary", args, async () => {
				const { folderId } = await useCases.resolveFolderPath.execute({
					path: args.path,
				});
				const view = await useCases.browseFolder.execute({ folderId });

				return ok(
					view.summary ?? `${args.path.join(" / ")} has no summary yet.`,
					{
						folderId,
						name: view.name,
						icon: view.icon,
						summary: view.summary,
						pages: view.children.map((child) => child.name),
						quizzes: view.sets.map(summaryOf),
						attached: view.attached.map(summaryOf),
					},
				);
			}),
	);
}
