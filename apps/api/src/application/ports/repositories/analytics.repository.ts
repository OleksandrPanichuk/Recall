import type { QuestionId } from "@/domain/quiz-set/question";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";

export interface DailyActivity {
	readonly day: string;
	readonly attempts: number;
	readonly answered: number;
	readonly correct: number;
}

export interface DueForecastDay {
	readonly day: string;
	readonly due: number;
}

export interface QuestionStat {
	readonly questionId: QuestionId;
	readonly quizSetId: QuizSetId;
	readonly quizSetTitle: string;
	readonly prompt: string;
	readonly answered: number;
	readonly correct: number;
	readonly lapses: number;
}

export interface AnalyticsWindow {
	readonly from: Date;
	readonly to: Date;
	readonly timezone: string;
}

export interface AnalyticsRepository {
	dailyActivity(window: AnalyticsWindow): Promise<readonly DailyActivity[]>;
	dueForecast(window: AnalyticsWindow): Promise<readonly DueForecastDay[]>;
	hardestQuestions(
		limit: number,
		minimumAnswers: number,
	): Promise<readonly QuestionStat[]>;
}
