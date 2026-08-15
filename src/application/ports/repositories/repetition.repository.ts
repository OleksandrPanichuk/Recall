import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type {
	RepetitionSchedule,
	RepetitionSettings,
} from "@/domain/repetition/repetition";

export interface RepetitionRepository {
	saveSchedule(schedule: RepetitionSchedule): void;
	findSchedule(
		quizSetId: QuizSetId,
		telegramUserId: number,
	): RepetitionSchedule | undefined;
	listDue(telegramUserId: number, at: Date): readonly RepetitionSchedule[];
	saveSettings(quizSetId: QuizSetId, settings: RepetitionSettings): void;
	findSettings(quizSetId: QuizSetId): RepetitionSettings | undefined;
	saveDefaults(settings: RepetitionSettings): void;
	findDefaults(): RepetitionSettings | undefined;
}
