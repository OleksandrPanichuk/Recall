import { expectsTypedAnswer } from "@recall/contracts";
import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import type {
	AnswerCallback,
	RevealCallback,
	ToggleCallback,
} from "../callbacks/callback-data.types";
import { finishPrompt, notice } from "../presenters/menu.presenter";
import { questionScreen } from "../presenters/question.presenter";
import { answerFeedback } from "../presenters/result.presenter";
import type { Screen } from "../presenters/screen.types";
import { followedBy } from "../presenters/typed-question.presenter";
import { render } from "../screen";

const STALE = "Це питання вже позаду. Натисніть «Продовжити навчання».";

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
			questionId: callback.questionId,
			selectedOptionPositions: callback.optionPositions,
		});

		await afterAnswer(ctx, useCases, answerFeedback(result, result.question));
	};
}

async function afterAnswer(
	ctx: Context,
	useCases: TelegramUseCases,
	feedback: Screen,
	withNext = false,
): Promise<void> {
	const next = await useCases.getCurrentQuestion.execute({
		telegramUserId: ctx.from?.id ?? 0,
	});

	if (next?.examMode === true) {
		await render(
			ctx,
			next.question === undefined
				? finishPrompt()
				: questionScreen(next, next.question),
		);

		return;
	}

	await render(
		ctx,
		!withNext || next?.question === undefined
			? feedback
			: followedBy(feedback, questionScreen(next, next.question)),
	);
}

export function revealHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, callback: RevealCallback): Promise<void> => {
		const result = await useCases.answerQuestion.execute({
			telegramUserId: ctx.from?.id ?? 0,
			questionId: callback.questionId,
			revealed: true,
		});

		await afterAnswer(
			ctx,
			useCases,
			answerFeedback(result, result.question),
			true,
		);
	};
}

export function typedAnswerHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, text: string): Promise<boolean> => {
		const current = await useCases.getCurrentQuestion.execute({
			telegramUserId: ctx.from?.id ?? 0,
		});

		if (
			current?.question === undefined ||
			!expectsTypedAnswer(current.question)
		) {
			return false;
		}

		const result = await useCases.answerQuestion.execute({
			telegramUserId: ctx.from?.id ?? 0,
			questionId: current.question.id,
			typedAnswer: text,
		});

		await afterAnswer(
			ctx,
			useCases,
			answerFeedback(result, result.question),
			true,
		);

		return true;
	};
}
