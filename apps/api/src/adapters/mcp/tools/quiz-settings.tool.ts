import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toQuizSetId } from "@/domain/quiz-set/quiz-set";
import type { RepetitionSettings } from "@/domain/repetition/repetition";
import type { QuizSettings } from "@/domain/settings/quiz-settings";
import { ok } from "../presenters/tool-result.presenter";
import {
	quizSettingsScopeShape,
	quizSettingsShape,
} from "../schemas/settings.schema";
import type { McpUseCases } from "../server.types";
import type { ToolRunner } from "../utils/tool-logging";

const SOURCES: Readonly<Record<string, string>> = {
	set: "this set's own",
	global: "the global",
	default: "the built-in",
};

const describeRepetition = (settings: RepetitionSettings): string => {
	const effective = settings.intervalsDays.map((days) =>
		Math.min(days, settings.maxIntervalDays),
	);
	const pinned = effective.some(
		(days, index) => days !== settings.intervalsDays[index],
	);

	return `waits: ${effective.join(", ")} days${pinned ? ` (ceiling ${settings.maxIntervalDays} caps ${settings.intervalsDays.join(", ")})` : ""}, then ${effective.at(-1)} days each time; stops after ${settings.maxRepetitions} repetitions`;
};

const inFreshOrder = (shuffled: boolean): string =>
	shuffled
		? "in a fresh order every attempt"
		: "in the order they were authored";

const describe = (settings: QuizSettings): string =>
	`${describeRepetition(settings.repetition)}; options are shown ${inFreshOrder(settings.shuffleOptions)}; questions are asked ${inFreshOrder(settings.shuffleQuestions)}; verdicts are ${settings.examMode ? "withheld until the attempt is finished" : "shown after each answer"}`;

const structured = (settings: QuizSettings) => ({
	intervalsDays: [...settings.repetition.intervalsDays],
	maxIntervalDays: settings.repetition.maxIntervalDays,
	maxRepetitions: settings.repetition.maxRepetitions,
	shuffleOptions: settings.shuffleOptions,
	shuffleQuestions: settings.shuffleQuestions,
	examMode: settings.examMode,
});

export function registerQuizSettingsTools(
	server: McpServer,
	useCases: McpUseCases,
	runTool: ToolRunner,
): void {
	server.registerTool(
		"quiz_get_settings",
		{
			title: "Read the settings of a set",
			description:
				'Returns the repetition schedule and the two shuffle settings a set uses, and where they come from — source is "set", "global" or "default". Omit quizSetId to read the global settings.',
			inputSchema: quizSettingsScopeShape,
		},
		async (args) =>
			runTool("quiz_get_settings", args, async () => {
				const { settings, source } = await useCases.resolveQuizSettings.execute(
					{
						quizSetId:
							args.quizSetId === undefined
								? undefined
								: toQuizSetId(args.quizSetId),
					},
				);

				return ok(
					`Using ${SOURCES[source] ?? source} settings — ${describe(settings)}.`,
					{ source, ...structured(settings) },
				);
			}),
	);

	server.registerTool(
		"quiz_set_settings",
		{
			title: "Change the settings of a set",
			description:
				"Changes only the fields it is given. intervalsDays lists the waits between repetitions and the last one repeats until the limit; maxIntervalDays caps every wait, so a set can be pinned to weekly or monthly; maxRepetitions retires the set once reached; shuffleOptions decides whether answer options keep their authored order or get a fresh one each attempt, and shuffleQuestions does the same for the order the questions themselves are asked in — an attempt already under way keeps the order it started with; examMode withholds every verdict, correct answer, explanation and running score until the attempt is finished, so the whole set is answered blind and reviewed afterwards. Passing quizSetId pins that set to these settings — it stops following the global ones. Omit it to change the global settings. Pass inheritGlobal with a quizSetId to drop the set's own settings and follow the global ones again.",
			inputSchema: quizSettingsShape,
		},
		async (args) =>
			runTool("quiz_set_settings", args, async () => {
				const quizSetId =
					args.quizSetId === undefined
						? undefined
						: toQuizSetId(args.quizSetId);
				const repetition =
					args.intervalsDays === undefined &&
					args.maxIntervalDays === undefined &&
					args.maxRepetitions === undefined
						? undefined
						: await repetitionFrom(useCases, quizSetId, args);

				const settings = await useCases.updateQuizSettings.execute({
					quizSetId,
					repetition,
					shuffleOptions: args.shuffleOptions,
					shuffleQuestions: args.shuffleQuestions,
					examMode: args.examMode,
					inheritGlobal: args.inheritGlobal,
				});

				return ok(`${quizSetId ?? "Global"} — ${describe(settings)}.`, {
					quizSetId: args.quizSetId,
					...structured(settings),
				});
			}),
	);
}

async function repetitionFrom(
	useCases: McpUseCases,
	quizSetId: ReturnType<typeof toQuizSetId> | undefined,
	args: {
		scheduler?: "ladder" | "fsrs";
		desiredRetention?: number;
		intervalsDays?: readonly number[];
		maxIntervalDays?: number;
		maxRepetitions?: number;
	},
): Promise<RepetitionSettings> {
	const { settings } = await useCases.resolveQuizSettings.execute({
		quizSetId,
	});

	return {
		scheduler: args.scheduler ?? settings.repetition.scheduler,
		desiredRetention:
			args.desiredRetention ?? settings.repetition.desiredRetention,
		intervalsDays: args.intervalsDays ?? settings.repetition.intervalsDays,
		maxIntervalDays:
			args.maxIntervalDays ?? settings.repetition.maxIntervalDays,
		maxRepetitions: args.maxRepetitions ?? settings.repetition.maxRepetitions,
	};
}
