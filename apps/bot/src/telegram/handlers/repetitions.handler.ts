import type { Context } from "telegraf";
import type { TelegramUseCases } from "../bot";
import type { RetireCallback } from "../callbacks/callback-data.types";
import {
	leechesScreen,
	repetitionsScreen,
	retiredScreen,
} from "../presenters/repetitions.presenter";
import { render } from "../screen";

export function repetitionsHandler(useCases: TelegramUseCases) {
	return async (ctx: Context): Promise<void> => {
		const [due, leeches] = await Promise.all([
			useCases.listDueRepetitions.execute({}),
			useCases.listLeeches.execute({}),
		]);

		await render(ctx, repetitionsScreen(due, leeches));
	};
}

export function leechesHandler(useCases: TelegramUseCases) {
	return async (ctx: Context): Promise<void> => {
		await render(ctx, leechesScreen(await useCases.listLeeches.execute({})));
	};
}

export function retiredHandler(useCases: TelegramUseCases) {
	return async (ctx: Context): Promise<void> => {
		await render(ctx, retiredScreen(await useCases.listRetired.execute({})));
	};
}

export function retireHandler(useCases: TelegramUseCases) {
	return async (ctx: Context, callback: RetireCallback): Promise<void> => {
		await useCases.retireQuestion.execute({
			questionId: callback.questionId,
			retired: callback.retired,
		});

		await (callback.retired
			? leechesHandler(useCases)(ctx)
			: retiredHandler(useCases)(ctx));
	};
}
