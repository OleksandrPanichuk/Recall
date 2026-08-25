import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { type OwnerId, toOwnerId } from "@/application/ports/owner";
import { account, user } from "./auth-schema";
import type { RecallDatabase } from "./client";

export const TELEGRAM_PROVIDER = "telegram";

const placeholderEmailFor = (telegramUserId: number): string =>
	`telegram-${telegramUserId}@telegram.invalid`;

export async function findTelegramOwner(
	db: RecallDatabase,
	telegramUserId: number,
): Promise<OwnerId | undefined> {
	const [row] = await db
		.select({ userId: account.userId })
		.from(account)
		.where(
			and(
				eq(account.providerId, TELEGRAM_PROVIDER),
				eq(account.accountId, String(telegramUserId)),
			),
		)
		.limit(1);

	return row === undefined ? undefined : toOwnerId(row.userId);
}

// One place decides which telegram id owns which rows. The bot's login flow and
// the etl both go through here, so an import can never land under a different
// user than the one the bot will hand the platform to.
export async function ensureTelegramOwner(
	db: RecallDatabase,
	telegramUserId: number,
	displayName?: string,
): Promise<OwnerId> {
	const existing = await findTelegramOwner(db, telegramUserId);

	if (existing !== undefined) {
		return existing;
	}

	const id = randomUUID();
	const now = new Date();

	await db.transaction(async (transaction) => {
		await transaction.insert(user).values({
			id,
			name: displayName ?? `Telegram ${telegramUserId}`,
			email: placeholderEmailFor(telegramUserId),
			emailVerified: false,
			createdAt: now,
			updatedAt: now,
		});
		await transaction.insert(account).values({
			id: randomUUID(),
			accountId: String(telegramUserId),
			providerId: TELEGRAM_PROVIDER,
			userId: id,
			createdAt: now,
			updatedAt: now,
		});
	});

	return toOwnerId(id);
}
