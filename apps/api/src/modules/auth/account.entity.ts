import type { account } from "@/db/schema";

export type AccountRow = typeof account.$inferSelect;

export interface AccountEntity extends AccountRow {}

export class AccountEntity {
	private constructor() {}

	static readonly TELEGRAM_PROVIDER = "telegram";

	static telegramAccountId(telegramUserId: number): string {
		return String(telegramUserId);
	}

	static placeholderEmailFor(telegramUserId: number): string {
		return `telegram-${telegramUserId}@telegram.invalid`;
	}

	static displayNameFor(telegramUserId: number, given?: string): string {
		const trimmed = given?.trim();

		return trimmed === undefined || trimmed.length === 0
			? `Telegram ${telegramUserId}`
			: trimmed;
	}
}
