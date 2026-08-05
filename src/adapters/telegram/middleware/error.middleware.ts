import type { Context, MiddlewareFn } from "telegraf";
import { AttemptNotActiveError } from "@/application/use-cases/attempts/answer-question";
import { NoActiveAttemptError } from "@/application/use-cases/attempts/resume-quiz-attempt";
import {
	AttemptAlreadyInProgressError,
	QuizSetNotPublishedError,
} from "@/application/use-cases/attempts/start-quiz-attempt";
import { QuizSetNotFoundError } from "@/application/use-cases/quiz-sets/update-quiz-set";
import { QuestionNotInAttemptError } from "@/domain/quiz-attempt/quiz-attempt.errors";

/**
 * Maps the errors a handler can raise into short user-facing text. Domain and
 * application errors never reach the user verbatim, and Telegraf errors never
 * travel inwards.
 */
export function userMessageFor(error: unknown): string {
	if (error instanceof NoActiveAttemptError) {
		return "Немає активної спроби. Оберіть набір у меню.";
	}

	if (error instanceof AttemptAlreadyInProgressError) {
		return "У вас є незавершена спроба. Завершіть її, перш ніж почати іншу.";
	}

	if (error instanceof AttemptNotActiveError) {
		return "Спробу призупинено. Натисніть «Продовжити навчання».";
	}

	if (error instanceof QuestionNotInAttemptError) {
		return "Це питання вже позаду. Оновіть екран.";
	}

	if (error instanceof QuizSetNotPublishedError) {
		return "Цей набір ще не опубліковано.";
	}

	if (error instanceof QuizSetNotFoundError) {
		return "Набір не знайдено.";
	}

	return "Сталася помилка. Спробуйте ще раз.";
}

export function errorMiddleware(
	log: (error: unknown) => void = console.error,
): MiddlewareFn<Context> {
	return async (ctx, next) => {
		try {
			await next();
		} catch (error) {
			log(error);

			const message = userMessageFor(error);

			if (ctx.callbackQuery !== undefined) {
				await ctx.answerCbQuery(message);

				return;
			}

			await ctx.reply(message);
		}
	};
}
