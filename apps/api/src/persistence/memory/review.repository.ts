import type {
	ReviewRepository,
	SettingsScope,
} from "@/application/ports/repositories/review.repository";
import { type QuestionId } from "@/modules/quizzes";
import { ScheduleEntity } from "@/modules/scheduling";
import { StudySettingsEntity } from "@/modules/study-settings";
import type { MemoryStore } from "./store";

export const settingsKey = (scope: SettingsScope): string =>
	scope.kind === "owner" ? "owner" : `quiz:${String(scope.quizId)}`;

export function createMemoryReviewRepository(
	store: MemoryStore,
): ReviewRepository {
	const all = (): readonly ScheduleEntity[] => [...store.schedules.values()];

	return {
		async saveSchedules(schedules: readonly ScheduleEntity[]): Promise<void> {
			for (const schedule of schedules) {
				store.schedules.set(String(schedule.questionId), schedule);
			}
		},

		async findSchedules(
			questionIds: readonly QuestionId[],
		): Promise<readonly ScheduleEntity[]> {
			const wanted = new Set(questionIds.map(String));

			return all().filter((schedule) =>
				wanted.has(String(schedule.questionId)),
			);
		},

		async listDue(at: Date): Promise<readonly ScheduleEntity[]> {
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

		async listLeeches(threshold: number): Promise<readonly ScheduleEntity[]> {
			return all()
				.filter((schedule) => schedule.lapses >= threshold)
				.sort((left, right) => right.lapses - left.lapses);
		},

		async saveSettings(
			scope: SettingsScope,
			settings: StudySettingsEntity,
		): Promise<void> {
			store.settings.set(settingsKey(scope), settings);
		},

		async findSettings(
			scope: SettingsScope,
		): Promise<StudySettingsEntity | undefined> {
			return store.settings.get(settingsKey(scope));
		},

		async clearSettings(scope: SettingsScope): Promise<void> {
			store.settings.delete(settingsKey(scope));
		},
	};
}
