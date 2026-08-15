import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import { ok } from "../presenters/tool-result.presenter";
import {
	repetitionScopeShape,
	repetitionSettingsShape,
} from "../schemas/repetition.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

const SOURCES: Readonly<Record<string, string>> = {
	set: "this set's own",
	global: "the global",
	default: "the built-in",
};

const describe = (settings: {
	intervalsDays: readonly number[];
	maxIntervalDays: number;
	maxRepetitions: number;
}): string => {
	const effective = settings.intervalsDays.map((days) =>
		Math.min(days, settings.maxIntervalDays),
	);
	const pinned = effective.some(
		(days, index) => days !== settings.intervalsDays[index],
	);

	return `waits: ${effective.join(", ")} days${pinned ? ` (ceiling ${settings.maxIntervalDays} caps ${settings.intervalsDays.join(", ")})` : ""}, then ${effective.at(-1)} days each time; stops after ${settings.maxRepetitions} repetitions`;
};

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
				'Returns the repetition schedule a set uses and where it comes from — source is "set", "global" or "default". Omit quizSetId to read the global settings. Writing back what you read for a set pins it: it stops following the global schedule.',
			inputSchema: repetitionScopeShape,
		},
		async (args) =>
			runTool("quiz_get_repetition_settings", args, async () => {
				const { settings, source } =
					await useCases.resolveRepetitionSettings.execute({
						quizSetId:
							args.quizSetId === undefined
								? undefined
								: toQuizSetId(args.quizSetId),
					});

				return ok(
					`Using ${SOURCES[source] ?? source} schedule — ${describe(settings)}.`,
					{
						source,
						intervalsDays: [...settings.intervalsDays],
						maxIntervalDays: settings.maxIntervalDays,
						maxRepetitions: settings.maxRepetitions,
					},
				);
			}),
	);

	server.registerTool(
		"quiz_set_repetition_settings",
		{
			title: "Change repetition settings",
			description:
				"Sets how often a quiz set comes back. intervalsDays lists the waits between repetitions and the last one repeats until the limit; maxIntervalDays caps every wait, so a set can be pinned to weekly or monthly; maxRepetitions retires the set once reached. Passing quizSetId pins that set to these settings — it will no longer follow the global schedule. Omit it to change the global settings instead.",
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
