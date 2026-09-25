import {
	ApiErrorName,
	isApiError,
	type PracticeMode,
	type QuizSetId,
} from "@recall/contracts";
import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import { nothingToPractise } from "../presenters/practice.presenter";
import { render } from "../screen";
import { showCurrentQuestion } from "./utils/show-current-question";

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

		await showCurrentQuestion(ctx, useCases);
	};
}
