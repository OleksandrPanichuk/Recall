import type { Context } from "telegraf";
import { expectsTypedAnswer, toQuestionId } from "@/domain/quiz-set/question";
import type { TelegramUseCases } from "../bot";
import type {
	AnswerCallback,
	RevealCallback,
	ToggleCallback,
} from "../callbacks/callback-data.types";
import { notice } from "../presenters/menu.presenter";
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
			questionId: toQuestionId(callback.questionId),
			selectedOptionPositions: callback.optionPositions,
		});

		await render(ctx, answerFeedback(result, result.question));
	};
}

async function renderWithNext(
	ctx: Context,
	useCases: TelegramUseCases,
	feedback: Screen,
): Promise<void> {
	const next = await useCases.getCurrentQuestion.execute({
		telegramUserId: ctx.from?.id ?? 0,
	});

	await render(
		ctx,
		next?.question === undefined
			? feedback
			: followedBy(feedback, questionScreen(next, next.question)),
	);
}

export function revealHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, callback: RevealCallback): Promise<void> => {
		const result = await useCases.answerQuestion.execute({
			telegramUserId: ctx.from?.id ?? 0,
			questionId: toQuestionId(callback.questionId),
			revealed: true,
		});

		await renderWithNext(
			ctx,
			useCases,
			answerFeedback(result, result.question),
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

		await renderWithNext(
			ctx,
			useCases,
			answerFeedback(result, result.question),
		);

		return true;
	};
}
