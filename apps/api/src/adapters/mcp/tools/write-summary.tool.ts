import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ok } from "../presenters/tool-result.presenter";
import { writeSummaryShape } from "../schemas/folder.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerWriteSummaryTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_write_summary",
		{
			title: "Write a page summary",
			description:
				"Stores markdown as the summary of the page at the given path, creating the path if it does not exist. Replaces whatever was there; send an empty string to clear it. Quizzes filed under the same page are shown beneath the summary.",
			inputSchema: writeSummaryShape,
		},
		async (args) =>
			runTool("quiz_write_summary", args, async () => {
				const { folderId } = await useCases.ensureFolderPath.execute({
					path: args.path,
				});
				const written = await useCases.writeSummary.execute({
					folderId,
					summary: args.summary,
				});

				return ok(
					written.length === 0
						? `Cleared the summary of ${args.path.join(" / ")}.`
						: `Wrote ${written.length} characters to ${args.path.join(" / ")}.`,
					{ folderId, name: written.name, length: written.length },
				);
			}),
	);
}
