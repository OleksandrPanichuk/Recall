import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ok } from "../presenters/tool-result.presenter";
import { folderPathShape } from "../schemas/folder.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerDeleteFolderTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_delete_folder",
		{
			title: "Delete an empty folder",
			description:
				"Deletes the folder at the given path. Refuses while it still holds subfolders or sets, so no quiz set is ever destroyed by a folder operation.",
			inputSchema: folderPathShape,
		},
		async (args) =>
			runTool("quiz_delete_folder", args, async () => {
				const { folderId } = await useCases.resolveFolderPath.execute({
					path: args.path,
				});

				await useCases.deleteFolder.execute({ folderId });

				return ok(`Deleted ${args.path.join(" / ")}.`, { folderId });
			}),
	);
}
