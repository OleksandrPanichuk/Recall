import type { Context } from "telegraf";
import {
	NothingToPracticeError,
	type PracticeMode,
} from "@/application/use-cases/practice/start-practice-session";
import type { QuizSetId } from "@/domain/quiz-set/quiz-set";
import type { TelegramUseCases } from "../bot";
import { finishPrompt } from "../presenters/menu.presenter";
import { nothingToPractise } from "../presenters/practice.presenter";
import { questionScreen } from "../presenters/question.presenter";
import { render } from "../screen";

export interface PracticeRequest {
	readonly telegramUserId: number;
	readonly quizSetId: QuizSetId;
	readonly mode: PracticeMode;
}

export function practiceHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, request: PracticeRequest): Promise<void> => {
		try {
			await useCases.startPracticeSession.execute(request);
		} catch (error) {
			if (error instanceof NothingToPracticeError) {
				await render(ctx, nothingToPractise(error.mode, error.folderId));

				return;
			}

			throw error;
		}

		const current = await useCases.getCurrentQuestion.execute({
			telegramUserId: request.telegramUserId,
		});

		if (current === undefined || current.question === undefined) {
			await render(ctx, finishPrompt());

			return;
		}

		await render(ctx, questionScreen(current, current.question));
	};
}
