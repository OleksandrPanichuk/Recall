import { type QuestionId, type QuizSetId } from "@/modules/quizzes";

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

export abstract class AnalyticsRepository {
	abstract dailyActivity(
		window: AnalyticsWindow,
	): Promise<readonly DailyActivity[]>;
	abstract dueForecast(
		window: AnalyticsWindow,
	): Promise<readonly DueForecastDay[]>;
	abstract hardestQuestions(
		limit: number,
		minimumAnswers: number,
	): Promise<readonly QuestionStat[]>;
}
