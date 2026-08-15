import type { QuestionId } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type {
	RepetitionSchedule,
	RepetitionSettings,
} from "@/domain/repetition/repetition";

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
	saveSettings(quizSetId: QuizSetId, settings: RepetitionSettings): void;
	findSettings(quizSetId: QuizSetId): RepetitionSettings | undefined;
	saveDefaults(settings: RepetitionSettings): void;
	findDefaults(): RepetitionSettings | undefined;
}
