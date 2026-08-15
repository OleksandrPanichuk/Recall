import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { silentLogger } from "@/infrastructure/logging/logger";
import type { McpServerOptions, McpUseCases } from "./server.types";
import { registerAddQuestionsTool } from "./tools/add-questions.tool";
import { registerAddVocabularyTool } from "./tools/add-vocabulary.tool";
import { registerArchiveSetTool } from "./tools/archive-set.tool";
import { registerCreateSetTool } from "./tools/create-set.tool";
import { registerDeleteFolderTool } from "./tools/delete-folder.tool";
import { registerEnsureFolderPathTool } from "./tools/ensure-folder-path.tool";
import { registerGetSetTool } from "./tools/get-set.tool";
import { registerListFoldersTool } from "./tools/list-folders.tool";
import { registerListSetsTool } from "./tools/list-sets.tool";
import { registerListVocabularyTool } from "./tools/list-vocabulary.tool";
import { registerMoveSetTool } from "./tools/move-set.tool";
import { registerPublishSetTool } from "./tools/publish-set.tool";
import { registerRenameFolderTool } from "./tools/rename-folder.tool";
import { registerRepetitionSettingsTools } from "./tools/repetition-settings.tool";
import { registerUpdateSetTool } from "./tools/update-set.tool";
import { registerUpdateVocabularyTool } from "./tools/update-vocabulary.tool";
import { createToolRunner } from "./utils/tool-logging";

export type { McpServerOptions, McpUseCases } from "./server.types";

export const MCP_SERVER_NAME = "recall-quiz";
export const MCP_SERVER_VERSION = "0.1.0";

export function createMcpServer(
	useCases: McpUseCases,
	options: McpServerOptions = {},
): McpServer {
	const server = new McpServer({
		name: MCP_SERVER_NAME,
		version: MCP_SERVER_VERSION,
	});
	const runTool = createToolRunner(options.logger ?? silentLogger);

	registerCreateSetTool(server, useCases, runTool);
	registerAddQuestionsTool(server, useCases, runTool);
	registerAddVocabularyTool(server, useCases, runTool);
	registerUpdateSetTool(server, useCases, runTool);
	registerUpdateVocabularyTool(server, useCases, runTool);
	registerListVocabularyTool(server, useCases, runTool);
	registerPublishSetTool(server, useCases, runTool);
	registerArchiveSetTool(server, useCases, runTool);
	registerGetSetTool(server, useCases, runTool);
	registerListSetsTool(server, useCases, runTool);
	registerListFoldersTool(server, useCases, runTool);
	registerEnsureFolderPathTool(server, useCases, runTool);
	registerMoveSetTool(server, useCases, runTool);
	registerRenameFolderTool(server, useCases, runTool);
	registerRepetitionSettingsTools(server, useCases, runTool);
	registerDeleteFolderTool(server, useCases, runTool);

	return server;
}
