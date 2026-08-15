import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describeFolderTree, ok } from "../presenters/tool-result.presenter";
import { listFoldersShape } from "../schemas/folder.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

export function registerListFoldersTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_list_folders",
		{
			title: "List the folder tree",
			description:
				"Renders the whole folder tree, indented by depth, with the number of published sets filed directly in each folder. Counts are not recursive.",
			inputSchema: listFoldersShape,
		},
		async () =>
			runTool("quiz_list_folders", {}, async () => {
				const nodes = await useCases.listFolderTree.execute({});

				return ok(describeFolderTree(nodes), {
					folders: nodes.map((node) => ({
						id: node.id,
						name: node.name,
						parentId: node.parentId,
						setCount: node.setCount,
						unpublishedCount: node.unpublishedCount,
					})),
					count: nodes.length,
				});
			}),
	);
}
