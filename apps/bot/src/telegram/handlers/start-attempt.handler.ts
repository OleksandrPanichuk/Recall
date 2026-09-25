import type { QuizSetId } from "@recall/contracts";
import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import { showCurrentQuestion } from "./utils/show-current-question";

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

		await showCurrentQuestion(ctx, useCases);
	};
}
