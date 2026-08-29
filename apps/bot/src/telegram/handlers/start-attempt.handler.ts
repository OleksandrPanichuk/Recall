import type { QuizSetId } from "@recall/contracts";
import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import { finishPrompt } from "../presenters/menu.presenter";
import { questionScreen } from "../presenters/question.presenter";
import { render } from "../screen";

export interface StartAttemptRequest {
	readonly quizSetId: QuizSetId;
	readonly onlyDue?: boolean;
}

export function startAttemptHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, request: StartAttemptRequest): Promise<void> => {
		await useCases.startQuizAttempt.execute({
			...request,
			telegramUserId: ctx.from?.id,
		});

		const current = await useCases.getCurrentQuestion.execute({});

		if (current === undefined || current.question === undefined) {
			await render(ctx, finishPrompt());

			return;
		}

		await render(ctx, questionScreen(current, current.question));
	};
}
