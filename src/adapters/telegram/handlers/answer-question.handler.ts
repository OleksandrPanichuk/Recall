import type { Context } from "telegraf";
import { toQuestionId } from "@/domain/quiz-set/question";
import type { TelegramUseCases } from "../bot";
import type {
	AnswerCallback,
	ToggleCallback,
} from "../callbacks/callback-data";
import { notice } from "../presenters/menu.presenter";
import { questionScreen } from "../presenters/question.presenter";
import { answerFeedback } from "../presenters/result.presenter";
import { render } from "../screen";

const STALE = "Це питання вже позаду. Натисніть «Продовжити навчання».";

/** Redraws the question with the selection the tap produced. Nothing is stored. */
export function toggleHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, callback: ToggleCallback): Promise<void> => {
		const current = await useCases.getCurrentQuestion.execute({
			telegramUserId: ctx.from?.id ?? 0,
		});

		if (
			current?.question === undefined ||
			current.question.id !== callback.questionId
		) {
			await render(ctx, notice(STALE));

			return;
		}

		await render(
			ctx,
			questionScreen(current, current.question, callback.optionPositions),
		);
	};
}

export function answerHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, callback: AnswerCallback): Promise<void> => {
		if (callback.optionPositions.length === 0) {
			await render(ctx, notice("Оберіть хоча б один варіант."));

			return;
		}

		const result = await useCases.answerQuestion.execute({
			telegramUserId: ctx.from?.id ?? 0,
			questionId: toQuestionId(callback.questionId),
			selectedOptionPositions: callback.optionPositions,
		});

		await render(ctx, answerFeedback(result, result.question));
	};
}
