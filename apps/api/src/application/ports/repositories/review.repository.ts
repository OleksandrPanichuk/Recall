import type { QuestionId } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type { RepetitionSchedule } from "@/domain/repetition/repetition";
import type { QuizSettings } from "@/domain/settings/quiz-settings";

export type SettingsScope =
	| { readonly kind: "owner" }
	| { readonly kind: "quiz"; readonly quizId: QuizSetId };

export interface ReviewRepository {
	saveSchedules(schedules: readonly RepetitionSchedule[]): Promise<void>;
	findSchedules(
		questionIds: readonly QuestionId[],
	): Promise<readonly RepetitionSchedule[]>;
	listDue(at: Date): Promise<readonly RepetitionSchedule[]>;
	listLeeches(threshold: number): Promise<readonly RepetitionSchedule[]>;
	saveSettings(scope: SettingsScope, settings: QuizSettings): Promise<void>;
	findSettings(scope: SettingsScope): Promise<QuizSettings | undefined>;
	clearSettings(scope: SettingsScope): Promise<void>;
}
