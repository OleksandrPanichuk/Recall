import type { ResolvedQuizSettings } from "@/application/use-cases/settings/resolve-quiz-settings";
import type { RepetitionSettings } from "@/domain/repetition/repetition";
import { INTERVAL_PRESETS } from "@/domain/settings/quiz-settings.constants";
import {
	CallbackAction,
	SettingsChange,
} from "../callbacks/callback-data.constants";
import type { SettingsEditCallback } from "../callbacks/callback-data.types";
import type { InlineButton, Screen } from "./screen.types";
import { button } from "./utils/button";
import { truncated } from "./utils/truncate";

const SOURCES: Readonly<Record<string, string>> = {
	set: "власні",
	global: "глобальні",
	default: "вбудовані",
};

const effectiveLadder = (repetition: RepetitionSettings): readonly number[] =>
	repetition.intervalsDays.map((days) =>
		Math.min(days, repetition.maxIntervalDays),
	);

const ladderLine = (repetition: RepetitionSettings): string => {
	const effective = effectiveLadder(repetition);
	const capped = effective.some(
		(days, index) => days !== repetition.intervalsDays[index],
	);

	return `Драбина: ${effective.join(" → ")} дн.${capped ? " (обрізана стелею)" : ""}`;
};

const matchesPreset = (
	repetition: RepetitionSettings,
	intervalsDays: readonly number[],
): boolean => repetition.intervalsDays.join(",") === intervalsDays.join(",");

export function settingsMenu(): Screen {
	return {
		text: "⚙️ Налаштування",
		keyboard: [
			[button("🌍 Загальні", { action: CallbackAction.SettingsFor })],
			[
				button("📚 Для набору", {
					action: CallbackAction.Browse,
					leaf: CallbackAction.SettingsFor,
				}),
			],
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}

export function settingsScreen(resolved: ResolvedQuizSettings): Screen {
	const { settings, source, quizSetId } = resolved;
	const { repetition } = settings;
	const edit = (
		change: SettingsChange,
		presetKey?: string,
	): SettingsEditCallback => ({
		action: CallbackAction.SettingsEdit,
		quizSetId,
		change,
		presetKey,
	});

	const presets = INTERVAL_PRESETS.map((preset) => [
		button(
			truncated(
				`${matchesPreset(repetition, preset.intervalsDays) ? "✓" : "○"} ${preset.label} ${preset.intervalsDays.join("·")}`,
			),
			edit(SettingsChange.Preset, preset.key),
		),
	]);

	const stepper = (
		label: string,
		down: SettingsChange,
		up: SettingsChange,
	): readonly InlineButton[] => [
		button("−", edit(down)),
		button(label, edit(SettingsChange.Nothing)),
		button("+", edit(up)),
	];

	const scope: InlineButton[][] =
		quizSetId === undefined
			? []
			: [
					[
						button(
							"↩︎ Скинути до глобальних",
							edit(SettingsChange.InheritGlobal),
						),
					],
					[
						button("« До наборів", {
							action: CallbackAction.Browse,
							leaf: CallbackAction.SettingsFor,
							folderId: resolved.folderId,
						}),
					],
				];

	return {
		text: [
			`⚙️ ${resolved.title ?? "Загальні налаштування"}`,
			"",
			`Джерело: ${SOURCES[source] ?? source}`,
			ladderLine(repetition),
			`Стеля: ${repetition.maxIntervalDays} дн.  ·  Максимум повторень: ${repetition.maxRepetitions}`,
			`Перемішувати варіанти: ${settings.shuffleOptions ? "так" : "ні"}`,
		].join("\n"),
		keyboard: [
			...presets,
			stepper(
				`Стеля: ${repetition.maxIntervalDays} дн.`,
				SettingsChange.CeilingDown,
				SettingsChange.CeilingUp,
			),
			stepper(
				`Повторень: ${repetition.maxRepetitions}`,
				SettingsChange.RepetitionsDown,
				SettingsChange.RepetitionsUp,
			),
			[
				button(
					`🔀 Перемішувати варіанти: ${settings.shuffleOptions ? "так" : "ні"}`,
					edit(SettingsChange.Shuffle),
				),
			],
			...scope,
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}
