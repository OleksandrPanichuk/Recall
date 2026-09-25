import { describe, expect, test } from "bun:test";
import type { Context } from "telegraf";
import { loginLinkScreen } from "./presenters/login.presenter";
import { mainMenu } from "./presenters/menu.presenter";
import { TELEGRAM_TEXT_LIMIT } from "./presenters/utils/text-limit";
import { messageFor, render } from "./screen";

const replies: { text: string; extra: Record<string, unknown> }[] = [];

const ctx = {
	callbackQuery: undefined,
	reply: async (text: string, extra: Record<string, unknown>) => {
		replies.push({ text, extra });
	},
} as unknown as Context;

describe("rendering a screen", () => {
	test("a login link is sent without a link preview", async () => {
		replies.length = 0;

		await render(
			ctx,
			loginLinkScreen(
				"https://recall.example/api/auth/telegram/verify?token=secret",
				new Date(Date.now() + 300_000),
			),
		);

		expect(replies[0]?.extra.link_preview_options).toEqual({
			is_disabled: true,
		});
	});

	test("an ordinary screen leaves previews alone", () => {
		const { extra } = messageFor(
			mainMenu({ hasUnfinishedAttempt: false, awaitingFinish: false }),
		);

		expect(extra.link_preview_options).toBeUndefined();
	});

	test("text over the telegram limit is clamped", () => {
		const { text } = messageFor({ text: "a".repeat(5000), keyboard: [] });

		expect(text.length).toBeLessThanOrEqual(TELEGRAM_TEXT_LIMIT);
	});
});
