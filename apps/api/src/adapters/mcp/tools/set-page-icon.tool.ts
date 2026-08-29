import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ok } from "../presenters/tool-result.presenter";
import { setPageIconShape } from "../schemas/folder.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerSetPageIconTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_set_page_icon",
		{
			title: "Set a page icon",
			description:
				"Puts an emoji in front of the page's name everywhere it is listed. Send no icon to remove the one that is there.",
			inputSchema: setPageIconShape,
		},
		async (args) =>
			runTool("quiz_set_page_icon", args, async () => {
				const { folderId } = await useCases.resolveFolderPath.execute({
					path: args.path,
				});

				await useCases.setPageIcon.execute({ folderId, icon: args.icon });

				return ok(
					args.icon === undefined
						? `Removed the icon from ${args.path.join(" / ")}.`
						: `${args.icon} now marks ${args.path.join(" / ")}.`,
					{ folderId: String(folderId), icon: args.icon },
				);
			}),
	);
}
