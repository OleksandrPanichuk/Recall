import type {
	QuizSettings as WireQuizSettings,
	ResolvedQuizSettings as WireResolvedSettings,
} from "@recall/contracts";
import type { StudySettingsEntity } from "./study-settings.entity";
import type { ResolvedQuizSettings } from "./use-cases";

export const settingsToWire = (
	settings: StudySettingsEntity,
): WireQuizSettings => ({
	repetition: {
		scheduler: settings.repetition.scheduler,
		intervalsDays: [...settings.repetition.intervalsDays],
		maxIntervalDays: settings.repetition.maxIntervalDays,
		maxRepetitions: settings.repetition.maxRepetitions,
		desiredRetention: settings.repetition.desiredRetention,
	},
	shuffleOptions: settings.shuffleOptions,
	shuffleQuestions: settings.shuffleQuestions,
	examMode: settings.examMode,
});

export const resolvedSettingsToWire = (
	resolved: ResolvedQuizSettings,
): WireResolvedSettings => ({
	settings: settingsToWire(resolved.settings),
	source: resolved.source,
	quizSetId:
		resolved.quizSetId === undefined ? undefined : String(resolved.quizSetId),
	title: resolved.title,
	folderId:
		resolved.folderId === undefined ? undefined : String(resolved.folderId),
});
