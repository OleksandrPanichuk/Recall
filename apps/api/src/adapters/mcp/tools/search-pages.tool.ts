import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ok } from "../presenters/tool-result.presenter";
import { searchPagesShape } from "../schemas/folder.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerSearchPagesTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_search_pages",
		{
			title: "Search pages",
			description:
				"Finds pages whose title or summary matches the query, with a short excerpt around the match. Use this before writing a summary to see whether one already exists.",
			inputSchema: searchPagesShape,
		},
		async (args) =>
			runTool("quiz_search_pages", args, async () => {
				const matches = await useCases.searchPages.execute({
					query: args.query,
					limit: args.limit,
				});

				return ok(
					matches.length === 0
						? `Nothing matches "${args.query}".`
						: matches
								.map((match) =>
									match.excerpt === undefined
										? match.name
										: `${match.name} — ${match.excerpt}`,
								)
								.join("\n"),
					{
						matches: matches.map((match) => ({
							folderId: String(match.id),
							name: match.name,
							excerpt: match.excerpt,
						})),
					},
				);
			}),
	);
}
