import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { VocabularyItemView } from "@/application/use-cases/quiz-sets/list-vocabulary";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { ok } from "../presenters/tool-result.presenter";
import { listVocabularyShape } from "../schemas/vocabulary.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

const describeItem = (item: VocabularyItemView): string =>
	`${item.itemId}  ${item.terms.join(" / ")} — ${item.translations.join(" / ")}`;

export function registerListVocabularyTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_list_vocabulary",
		{
			title: "List the words of a set",
			description:
				"Lists the vocabulary items of a set with their ids, so a wrong translation spotted while studying can be corrected with quiz_update_vocabulary.",
			inputSchema: listVocabularyShape,
		},
		async (args) =>
			runTool("quiz_list_vocabulary", args, async () => {
				const items = await useCases.listVocabulary.execute({
					quizSetId: toQuizSetId(args.quizSetId),
				});

				return ok(
					items.length === 0
						? "This set has no vocabulary items."
						: items.map(describeItem).join("\n"),
					{ items, count: items.length },
				);
			}),
	);
}
