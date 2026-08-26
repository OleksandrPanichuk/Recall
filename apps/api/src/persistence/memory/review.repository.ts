import type {
	ReviewRepository,
	SettingsScope,
} from "@/application/ports/repositories/review.repository";
import type { QuestionId } from "@/domain/quiz-set/question";
import type { RepetitionSchedule } from "@/domain/repetition/repetition";
import type { QuizSettings } from "@/domain/settings/quiz-settings";
import type { MemoryStore } from "./store";

export const settingsKey = (scope: SettingsScope): string =>
	scope.kind === "owner" ? "owner" : `quiz:${String(scope.quizId)}`;

export function createMemoryReviewRepository(
	store: MemoryStore,
): ReviewRepository {
	// One store per owner: everything in it is theirs.
	const all = (): readonly RepetitionSchedule[] => [
		...store.schedules.values(),
	];

	return {
		async saveSchedules(
			schedules: readonly RepetitionSchedule[],
		): Promise<void> {
			for (const schedule of schedules) {
				store.schedules.set(String(schedule.questionId), schedule);
			}
		},

		async findSchedules(
			questionIds: readonly QuestionId[],
		): Promise<readonly RepetitionSchedule[]> {
			const wanted = new Set(questionIds.map(String));

			return all().filter((schedule) =>
				wanted.has(String(schedule.questionId)),
			);
		},

		async listDue(at: Date): Promise<readonly RepetitionSchedule[]> {
			return all()
				.filter(
					(schedule) =>
						schedule.dueAt !== undefined &&
						schedule.dueAt.getTime() <= at.getTime(),
				)
				.sort(
					(left, right) =>
						(left.dueAt?.getTime() ?? 0) - (right.dueAt?.getTime() ?? 0),
				);
		},

		async listLeeches(
			threshold: number,
		): Promise<readonly RepetitionSchedule[]> {
			return all()
				.filter((schedule) => schedule.lapses >= threshold)
				.sort((left, right) => right.lapses - left.lapses);
		},

		async saveSettings(
			scope: SettingsScope,
			settings: QuizSettings,
		): Promise<void> {
			store.settings.set(settingsKey(scope), settings);
		},

		async findSettings(
			scope: SettingsScope,
		): Promise<QuizSettings | undefined> {
			return store.settings.get(settingsKey(scope));
		},

		async clearSettings(scope: SettingsScope): Promise<void> {
			store.settings.delete(settingsKey(scope));
		},
	};
}
