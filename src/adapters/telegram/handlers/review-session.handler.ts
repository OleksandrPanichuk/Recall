import type { Context } from "telegraf";
import type { SessionMode } from "@/application/use-cases/review/start-review-session";
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
		await useCases.startReviewSession.execute({ telegramUserId, mode });
		const current = await useCases.getCurrentQuestion.execute({
			telegramUserId,
		});

		if (current?.question === undefined) {
			await render(ctx, notice("Не вдалося відкрити сесію. Спробуйте ще раз."));

			return;
		}

		// The heading comes from the attempt's own mode now, so it survives every
		// later screen instead of only this one.
		await render(ctx, questionScreen(current, current.question));
	};
}

export function rateHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, callback: RateCallback): Promise<void> => {
		if (!isReviewRating(callback.rating)) {
			await render(ctx, notice("Невідома оцінка."));

			return;
		}

		const { dueAt } = await useCases.rateReview.execute({
			telegramUserId: ctx.from?.id ?? 0,
			questionId: toQuestionId(callback.questionId),
			rating: callback.rating,
		});

		// The query was already answered by the router, so confirm on the screen.
		await render(
			ctx,
			notice(`Заплановано повторення на ${dueAt.toISOString().slice(0, 10)}.`),
		);
	};
}
