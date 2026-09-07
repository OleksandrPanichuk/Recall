import { type QuestionId, type QuizSetId } from "@/modules/quizzes";
import { ScheduleEntity } from "@/modules/scheduling";
import { StudySettingsEntity } from "@/modules/study-settings";

export type SettingsScope =
	| { readonly kind: "owner" }
	| { readonly kind: "quiz"; readonly quizId: QuizSetId };

export interface ReviewRepository {
	saveSchedules(schedules: readonly ScheduleEntity[]): Promise<void>;
	findSchedules(
		questionIds: readonly QuestionId[],
	): Promise<readonly ScheduleEntity[]>;
	listDue(at: Date): Promise<readonly ScheduleEntity[]>;
	listLeeches(threshold: number): Promise<readonly ScheduleEntity[]>;
	saveSettings(
		scope: SettingsScope,
		settings: StudySettingsEntity,
	): Promise<void>;
	findSettings(scope: SettingsScope): Promise<StudySettingsEntity | undefined>;
	clearSettings(scope: SettingsScope): Promise<void>;
}
