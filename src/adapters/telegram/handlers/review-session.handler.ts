import type { Context } from "telegraf";
import type { SessionMode } from "@/application/use-cases/review/start-review-session";
import { QuizAttemptMode } from "@/domain/quiz-attempt/quiz-attempt";
import { toQuestionId } from "@/domain/quiz-set/question";
import { isReviewRating } from "@/domain/review/review-schedule";
import type { TelegramUseCases } from "../bot";
import type { RateCallback } from "../callbacks/callback-data";
import { notice } from "../presenters/menu.presenter";
import { questionScreen } from "../presenters/question.presenter";
import { render } from "../screen";

export function reviewSessionHandler(
	useCases: TelegramUseCases,
	mode: SessionMode,
) {
	return async (ctx: Context): Promise<void> => {
		const telegramUserId = ctx.from?.id ?? 0;
		const started = await useCases.startReviewSession.execute({
			telegramUserId,
			mode,
		});
		const current = await useCases.getCurrentQuestion.execute({
			telegramUserId,
		});

		if (current === undefined) {
			await render(ctx, notice("Не вдалося відкрити сесію. Спробуйте ще раз."));

			return;
		}

		const heading =
			mode === QuizAttemptMode.WeakTopics && started.topic !== undefined
				? `📉 Слабка тема: ${started.topic}`
				: "🔁 Повторення помилок";

		await render(ctx, {
			...questionScreen(current),
			text: `${heading}\n\n${questionScreen(current).text}`,
		});
	};
}

export function rateHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, callback: RateCallback): Promise<void> => {
		if (!isReviewRating(callback.rating)) {
			await ctx.answerCbQuery("Невідома оцінка");

			return;
		}

		const { dueAt } = await useCases.rateReview.execute({
			telegramUserId: ctx.from?.id ?? 0,
			questionId: toQuestionId(callback.questionId),
			rating: callback.rating,
		});

		await ctx.answerCbQuery(
			`Наступне повторення: ${dueAt.toISOString().slice(0, 10)}`,
		);
	};
}
