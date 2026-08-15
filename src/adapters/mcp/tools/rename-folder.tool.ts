import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ok } from "../presenters/tool-result.presenter";
import { renameFolderShape } from "../schemas/folder.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerRenameFolderTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_rename_folder",
		{
			title: "Rename a folder",
			description:
				"Renames the folder at the given path. The sets and subfolders inside it are untouched.",
			inputSchema: renameFolderShape,
		},
		async (args) =>
			runTool("quiz_rename_folder", args, async () => {
				const { folderId } = await useCases.resolveFolderPath.execute({
					path: args.path,
				});

				await useCases.renameFolder.execute({ folderId, name: args.name });

				return ok(`Renamed ${args.path.join(" / ")} to "${args.name}".`, {
					folderId,
					name: args.name,
				});
			}),
	);
}
