import type { BotUseCases } from "@recall/contracts";
import { type DailyTimer, startDailyTimer } from "@recall/kit";
import type { Telegraf } from "telegraf";
import { repetitionsScreen } from "./presenters/repetitions.presenter";
import { messageFor } from "./screen";

export interface ReminderOptions {
	readonly bot: Telegraf;
	readonly listDueRepetitions: BotUseCases["listDueRepetitions"];
	readonly chatId: number;
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
			const due = await options.listDueRepetitions.execute({});

			if (due.length === 0) {
				return;
			}

			const { text, extra } = messageFor(repetitionsScreen(due));

			await options.bot.telegram.sendMessage(options.chatId, text, extra);
		},
	});
}
