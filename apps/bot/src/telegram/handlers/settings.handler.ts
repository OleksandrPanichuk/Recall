import type { QuizSettings, RepetitionSettings } from "@recall/contracts";
import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import { SettingsChange } from "../callbacks/callback-data.constants";
import type {
	SettingsEditCallback,
	SettingsForCallback,
} from "../callbacks/callback-data.types";
import { settingsMenu, settingsScreen } from "../presenters/settings.presenter";
import { render } from "../screen";
import {
	CEILING_STEPS,
	INTERVAL_PRESETS,
	REPETITION_STEPS,
	steppedDown,
	steppedUp,
} from "../settings.constants";

const scopeOf = (quizSetId: string | undefined) =>
	quizSetId === undefined ? undefined : quizSetId;

export function settingsMenuHandler() {
	return async (ctx: Context): Promise<void> => {
		await render(ctx, settingsMenu());
	};
}

export function settingsForHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, callback: SettingsForCallback): Promise<void> => {
		const resolved = await useCases.resolveQuizSettings.execute({
			quizSetId: scopeOf(callback.quizSetId),
		});

		await render(ctx, settingsScreen(resolved));
	};
}

function repetitionAfter(
	change: SettingsEditCallback["change"],
	presetKey: string | undefined,
	current: RepetitionSettings,
): RepetitionSettings | undefined {
	if (change === SettingsChange.Preset) {
		const preset = INTERVAL_PRESETS.find((entry) => entry.key === presetKey);

		if (preset === undefined) {
			return undefined;
		}

		return {
			...current,
			intervalsDays: preset.intervalsDays,
			maxIntervalDays: Math.max(
				current.maxIntervalDays,
				preset.intervalsDays.at(-1) ?? current.maxIntervalDays,
			),
		};
	}

	if (change === SettingsChange.CeilingUp) {
		return {
			...current,
			maxIntervalDays: steppedUp(CEILING_STEPS, current.maxIntervalDays),
		};
	}

	if (change === SettingsChange.CeilingDown) {
		return {
			...current,
			maxIntervalDays: steppedDown(CEILING_STEPS, current.maxIntervalDays),
		};
	}

	if (change === SettingsChange.RepetitionsUp) {
		return {
			...current,
			maxRepetitions: steppedUp(REPETITION_STEPS, current.maxRepetitions),
		};
	}

	if (change === SettingsChange.RepetitionsDown) {
		return {
			...current,
			maxRepetitions: steppedDown(REPETITION_STEPS, current.maxRepetitions),
		};
	}

	return undefined;
}

export function settingsEditHandler(useCases: TelegramUseCases) {
	return async (
		ctx: Context,
		callback: SettingsEditCallback,
	): Promise<void> => {
		const quizSetId = scopeOf(callback.quizSetId);
		const before = await useCases.resolveQuizSettings.execute({ quizSetId });

		if (callback.change !== SettingsChange.Nothing) {
			await useCases.updateQuizSettings.execute({
				quizSetId,
				...changeFor(callback, before.settings),
			});
		}

		await render(
			ctx,
			settingsScreen(await useCases.resolveQuizSettings.execute({ quizSetId })),
		);
	};
}

function changeFor(
	callback: SettingsEditCallback,
	current: QuizSettings,
): {
	repetition?: RepetitionSettings;
	shuffleOptions?: boolean;
	shuffleQuestions?: boolean;
	examMode?: boolean;
	inheritGlobal?: boolean;
} {
	if (callback.change === SettingsChange.ShuffleOptions) {
		return { shuffleOptions: !current.shuffleOptions };
	}

	if (callback.change === SettingsChange.ShuffleQuestions) {
		return { shuffleQuestions: !current.shuffleQuestions };
	}

	if (callback.change === SettingsChange.ExamMode) {
		return { examMode: !current.examMode };
	}

	if (callback.change === SettingsChange.InheritGlobal) {
		return { inheritGlobal: true };
	}

	return {
		repetition: repetitionAfter(
			callback.change,
			callback.presetKey,
			current.repetition,
		),
	};
}
