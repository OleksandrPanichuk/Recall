import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { ok } from "../presenters/tool-result.presenter";
import {
	repetitionScopeShape,
	repetitionSettingsShape,
} from "../schemas/repetition.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

const describe = (settings: {
	intervalsDays: readonly number[];
	maxIntervalDays: number;
	maxRepetitions: number;
}): string =>
	`intervals: ${settings.intervalsDays.join(", ")} days; ceiling ${settings.maxIntervalDays} days; stops after ${settings.maxRepetitions} repetitions`;

export function registerRepetitionSettingsTools(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_get_repetition_settings",
		{
			title: "Read repetition settings",
			description:
				"Returns the repetition schedule a set uses: its own settings if it has any, otherwise the global ones, otherwise the built-in defaults. Omit quizSetId to read the global settings.",
			inputSchema: repetitionScopeShape,
		},
		async (args) =>
			runTool("quiz_get_repetition_settings", args, async () => {
				const settings = await useCases.resolveRepetitionSettings.execute({
					quizSetId: toQuizSetId(args.quizSetId ?? "global"),
				});

				return ok(describe(settings), {
					intervalsDays: [...settings.intervalsDays],
					maxIntervalDays: settings.maxIntervalDays,
					maxRepetitions: settings.maxRepetitions,
				});
			}),
	);

	server.registerTool(
		"quiz_set_repetition_settings",
		{
			title: "Change repetition settings",
			description:
				"Sets how often a quiz set comes back. intervalsDays lists the waits between repetitions and the last one repeats forever; maxIntervalDays caps it, so a set can be pinned to weekly or monthly; maxRepetitions retires the set once reached. Omit quizSetId to change the global settings every set falls back to.",
			inputSchema: repetitionSettingsShape,
		},
		async (args) =>
			runTool("quiz_set_repetition_settings", args, async () => {
				const settings = await useCases.updateRepetitionSettings.execute({
					quizSetId:
						args.quizSetId === undefined
							? undefined
							: toQuizSetId(args.quizSetId),
					settings: {
						intervalsDays: args.intervalsDays,
						maxIntervalDays: args.maxIntervalDays,
						maxRepetitions: args.maxRepetitions,
					},
				});

				return ok(
					`${args.quizSetId === undefined ? "Global" : args.quizSetId} — ${describe(settings)}.`,
					{
						quizSetId: args.quizSetId,
						intervalsDays: [...settings.intervalsDays],
						maxIntervalDays: settings.maxIntervalDays,
						maxRepetitions: settings.maxRepetitions,
					},
				);
			}),
	);
}
