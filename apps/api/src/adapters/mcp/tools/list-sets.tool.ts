import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describeSummaries, ok } from "../presenters/tool-result.presenter";
import { listSetsShape } from "../schemas/quiz-set.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerListSetsTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_list_sets",
		{
			title: "List quiz sets",
			description:
				"Lists published sets, or every set including drafts and archived ones when includeUnpublished is true.",
			inputSchema: listSetsShape,
		},
		async (args) =>
			runTool("quiz_list_sets", args, async () => {
				const sets = await useCases.listQuizSets.execute(args);

				if (args.includeUnpublished === true) {
					return ok(describeSummaries(sets), { count: sets.length });
				}

				const all = await useCases.listQuizSets.execute({
					includeUnpublished: true,
				});
				const unpublished = all.length - sets.length;

				return ok(
					unpublished === 0
						? describeSummaries(sets)
						: `${describeSummaries(sets)}\n\n(${unpublished} unpublished set(s) not shown — call quiz_list_sets with includeUnpublished to see them.)`,
					{ count: sets.length, unpublishedCount: unpublished },
				);
			}),
	);
}
