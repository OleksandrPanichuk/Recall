import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Difficulty } from "@/domain/quiz-set/question";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { VocabularyDirection } from "@/domain/vocabulary/vocabulary-item";
import { ok } from "../presenters/tool-result.presenter";
import { addVocabularyShape } from "../schemas/vocabulary.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

const BOTH = [
	VocabularyDirection.TermToTranslation,
	VocabularyDirection.TranslationToTerm,
] as const;

const asList = (value: string | readonly string[]): readonly string[] =>
	typeof value === "string" ? [value] : value;

export function registerAddVocabularyTool(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_add_vocabulary",
		{
			title: "Add vocabulary to a draft",
			description:
				"Adds word pairs to a draft set. Each pair becomes one vocabulary item and, by default, two typed questions — one asking for the translation and one asking for the term — so each direction is drilled and scored on its own. Either side may list several accepted variants: the first is shown in the prompt, all are accepted as answers.",
			inputSchema: addVocabularyShape,
		},
		async (args) =>
			runTool("quiz_add_vocabulary", args, async () => {
				const directions =
					args.direction === undefined || args.direction === "both"
						? BOTH
						: [args.direction];

				const result = await useCases.addVocabulary.execute({
					quizSetId: toQuizSetId(args.quizSetId),
					pairs: args.pairs.map((pair) => ({
						term: asList(pair.term),
						translation: asList(pair.translation),
						transcription: pair.transcription,
						example: pair.example,
					})),
					directions,
					topic: args.topic,
					difficulty: args.difficulty as Difficulty | undefined,
				});

				if (result.alreadyPresent) {
					return ok(
						`No change: those ${args.pairs.length} pair(s) are already in ${args.quizSetId}.`,
						{ quizSetId: args.quizSetId, addedQuestionCount: 0 },
					);
				}

				return ok(
					`Added ${args.pairs.length} pair(s) as ${result.addedQuestionCount} questions to ${args.quizSetId}. The set is still a DRAFT — publish it with quiz_publish_set.`,
					{
						quizSetId: args.quizSetId,
						itemIds: [...result.itemIds],
						addedQuestionCount: result.addedQuestionCount,
						nextStep: "quiz_publish_set",
					},
				);
			}),
	);
}
