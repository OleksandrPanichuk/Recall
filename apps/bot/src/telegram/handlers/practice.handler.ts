import {
	ApiErrorName,
	isApiError,
	type PracticeMode,
	type QuizSetId,
} from "@recall/contracts";
import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import { finishPrompt } from "../presenters/menu.presenter";
import { nothingToPractise } from "../presenters/practice.presenter";
import { questionScreen } from "../presenters/question.presenter";
import { render } from "../screen";

export interface PracticeRequest {
	readonly quizSetId: QuizSetId;
	readonly mode: PracticeMode;
}

export function practiceHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, request: PracticeRequest): Promise<void> => {
		try {
			await useCases.startPracticeSession.execute({
				...request,
				telegramUserId: ctx.from?.id,
			});
		} catch (error) {
			if (isApiError(error, ApiErrorName.NothingToPractice)) {
				await render(
					ctx,
					nothingToPractise(request.mode, error.details.folderId),
				);

				return;
			}

			throw error;
		}

		const current = await useCases.getCurrentQuestion.execute({});

		if (current === undefined || current.question === undefined) {
			await render(ctx, finishPrompt());

			return;
		}

		await render(ctx, questionScreen(current, current.question));
	};
}
