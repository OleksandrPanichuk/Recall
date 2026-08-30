import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ok } from "../presenters/tool-result.presenter";
import {
	appendSummaryShape,
	summaryHistoryShape,
	writeSummaryShape,
} from "../schemas/folder.schema";
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
					authorKind: "mcp",
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

export function registerAppendSummaryTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_append_summary",
		{
			title: "Add to a page summary",
			description:
				"Appends markdown to the end of the page's summary, separated by a blank line, creating the page if it does not exist. Use this to write a long summary section by section without resending what is already there.",
			inputSchema: appendSummaryShape,
		},
		async (args) =>
			runTool("quiz_append_summary", args, async () => {
				const { folderId } = await useCases.ensureFolderPath.execute({
					path: args.path,
				});
				const written = await useCases.writeSummary.execute({
					folderId,
					summary: args.summary,
					append: true,
					authorKind: "mcp",
				});

				return ok(
					`${args.path.join(" / ")} is now ${written.length} characters long.`,
					{ folderId, name: written.name, length: written.length },
				);
			}),
	);

	server.registerTool(
		"quiz_summary_history",
		{
			title: "List earlier versions of a page",
			description:
				"Returns what the page's summary said before each rewrite, newest first, so an overwrite can be recovered.",
			inputSchema: summaryHistoryShape,
		},
		async (args) =>
			runTool("quiz_summary_history", args, async () => {
				const { folderId } = await useCases.resolveFolderPath.execute({
					path: args.path,
				});
				const revisions = await useCases.listRevisions.execute({
					folderId,
					limit: args.limit,
				});

				return ok(
					revisions.length === 0
						? `${args.path.join(" / ")} has never been rewritten.`
						: revisions
								.map(
									(revision) =>
										`${revision.createdAt.toISOString()} · ${revision.authorKind} · ${revision.summary?.length ?? 0} characters`,
								)
								.join("\n"),
					{
						folderId,
						revisions: revisions.map((revision) => ({
							id: revision.id,
							createdAt: revision.createdAt.toISOString(),
							authorKind: revision.authorKind,
							summary: revision.summary,
						})),
					},
				);
			}),
	);
}
