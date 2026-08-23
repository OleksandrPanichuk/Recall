import type { Context } from "telegraf";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type { TelegramUseCases } from "../bot";
import { statisticsScreen } from "../presenters/result.presenter";
import { render } from "../screen";

export interface StatisticsRequest {
	readonly telegramUserId: number;
	readonly quizSetId: QuizSetId;
}

export function statisticsHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, request: StatisticsRequest): Promise<void> => {
		const statistics = await useCases.getQuizStatistics.execute(request);

		await render(ctx, statisticsScreen(statistics));
	};
}
