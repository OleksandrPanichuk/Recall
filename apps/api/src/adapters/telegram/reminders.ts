import type { Telegraf } from "telegraf";
import type { ListDueRepetitionsUseCase } from "@/application/use-cases/repetition/list-due-repetitions";
import {
	type DailyTimer,
	startDailyTimer,
} from "@/infrastructure/lifecycle/daily-timer";
import { repetitionsScreen } from "./presenters/repetitions.presenter";

export interface ReminderOptions {
	readonly bot: Telegraf;
	readonly listDueRepetitions: ListDueRepetitionsUseCase;
	readonly telegramUserId: number;
	readonly timezone: string;
	readonly hour: number;
	readonly now: () => Date;
	readonly log?: (error: unknown) => void;
}

export function startDailyReminder(options: ReminderOptions): DailyTimer {
	return startDailyTimer({
		hour: options.hour,
		timezone: options.timezone,
		now: options.now,
		onError: options.log,
		run: async () => {
			const due = await options.listDueRepetitions.execute({
				telegramUserId: options.telegramUserId,
			});

			if (due.length === 0) {
				return;
			}

			const screen = repetitionsScreen(due);

			await options.bot.telegram.sendMessage(
				options.telegramUserId,
				screen.text,
				{
					reply_markup: {
						inline_keyboard: screen.keyboard.map((row) => [...row]),
					},
				},
			);
		},
	});
}
