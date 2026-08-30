import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ok } from "../presenters/tool-result.presenter";
import { folderPathShape } from "../schemas/folder.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerEnsureFolderPathTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_ensure_folder_path",
		{
			title: "Create a folder path",
			description:
				'Creates every missing folder along a path such as ["English","Vocabulary","By levels","A1"] and returns the id of the last one. Existing folders are reused, matching names case-insensitively, so calling this twice is safe.',
			inputSchema: folderPathShape,
		},
		async (args) =>
			runTool("quiz_ensure_folder_path", args, async () => {
				const result = await useCases.ensureFolderPath.execute(args);

				return ok(
					result.created.length === 0
						? `${args.path.join(" / ")} already exists.`
						: `${args.path.join(" / ")} is ready. Created: ${result.created.join(", ")}.`,
					{ folderId: result.folderId, created: [...result.created] },
				);
			}),
	);
}
