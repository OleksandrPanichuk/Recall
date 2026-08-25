import { ServiceUnavailableException } from "@nestjs/common";
import type { OwnerId } from "@/application/ports/owner";
import type { RecallDatabase } from "@/persistence/postgres/client";
import type { OwnerResolver } from "@/persistence/postgres/lazy-scope";
import { findTelegramOwner } from "@/persistence/postgres/owner";
import { loadApiEnvironment } from "../config/api-env";

// One instance, one owner: whoever holds the telegram account the bot admits.
// Every surface here — rest, admin, mcp, bot — serves that person, so the owner
// is resolved once and cached. Per-user credentials (phase 7c) turn this into a
// per-request lookup; nothing above it has to change for that.
export function instanceOwnerResolver(db: RecallDatabase): OwnerResolver {
	let cached: OwnerId | undefined;

	return async () => {
		if (cached !== undefined) {
			return cached;
		}

		const telegramUserId = loadApiEnvironment().allowedTelegramUserId;

		if (telegramUserId === 0) {
			throw new ServiceUnavailableException(
				"ALLOWED_TELEGRAM_USER_ID is not set, so this api has no owner",
			);
		}

		const owner = await findTelegramOwner(db, telegramUserId);

		if (owner === undefined) {
			throw new ServiceUnavailableException(
				"no owner has linked this instance yet — send /login to the bot first",
			);
		}

		cached = owner;

		return owner;
	};
}
