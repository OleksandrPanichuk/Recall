import type { QuestionId } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type { RepetitionSchedule } from "@/domain/repetition/repetition";
import type { QuizSettings } from "@/domain/settings/quiz-settings";

export interface RepetitionRepository {
	saveSchedules(schedules: readonly RepetitionSchedule[]): void;
	findSchedules(
		questionIds: readonly QuestionId[],
		telegramUserId: number,
	): readonly RepetitionSchedule[];
	listDue(telegramUserId: number, at: Date): readonly RepetitionSchedule[];
	listLeeches(
		telegramUserId: number,
		threshold: number,
	): readonly RepetitionSchedule[];
	saveSettings(quizSetId: QuizSetId, settings: QuizSettings): void;
	findSettings(quizSetId: QuizSetId): QuizSettings | undefined;
	clearSettings(quizSetId: QuizSetId): void;
	saveDefaults(settings: QuizSettings): void;
	findDefaults(): QuizSettings | undefined;
}
