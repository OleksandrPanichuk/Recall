import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toVocabularyItemId } from "@/domain/vocabulary/vocabulary-item";
import { ok } from "../presenters/tool-result.presenter";
import { updateVocabularyShape } from "../schemas/vocabulary.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

const asList = (
	value: string | readonly string[] | undefined,
): readonly string[] | undefined =>
	value === undefined ? undefined : typeof value === "string" ? [value] : value;

export function registerUpdateVocabularyTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_update_vocabulary",
		{
			title: "Correct a vocabulary item",
			description:
				"Changes one word pair and rebuilds the questions generated from it. The questions keep their ids, so the repetition history built up on them survives — correcting a translation fixes both directions at once instead of leaving one wrong.",
			inputSchema: updateVocabularyShape,
		},
		async (args) =>
			runTool("quiz_update_vocabulary", args, async () => {
				const result = await useCases.updateVocabulary.execute({
					itemId: toVocabularyItemId(args.itemId),
					term: asList(args.term),
					translation: asList(args.translation),
					transcription: args.transcription,
					example: args.example,
				});

				return ok(
					`Updated ${args.itemId} and rebuilt ${result.rebuiltQuestionCount} question(s).`,
					{
						itemId: args.itemId,
						rebuiltQuestionCount: result.rebuiltQuestionCount,
					},
				);
			}),
	);
}
