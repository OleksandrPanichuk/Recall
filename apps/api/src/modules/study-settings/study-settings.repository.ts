import type { QuizSetId } from "@/modules/quizzes";
import type { StudySettingsEntity } from "./study-settings.entity";

export type SettingsScope =
	| { readonly kind: "owner" }
	| { readonly kind: "quiz"; readonly quizId: QuizSetId };

export abstract class StudySettingsRepository {
	abstract saveSettings(
		scope: SettingsScope,
		settings: StudySettingsEntity,
	): Promise<void>;
	abstract findSettings(
		scope: SettingsScope,
	): Promise<StudySettingsEntity | undefined>;
	abstract clearSettings(scope: SettingsScope): Promise<void>;
}
