import { randomUUID } from "node:crypto";
import {
	Inject,
	Injectable,
	ServiceUnavailableException,
} from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { account, authEvents, user } from "@/persistence/postgres/auth-schema";
import type { PostgresConnection } from "@/persistence/postgres/client";
import { loadApiEnvironment } from "../shared/config/api-env";
import { CONNECTION } from "../shared/database/tokens";
import { AUTH_BASE_PATH, type RecallAuth } from "./build-auth";
import {
	DEFAULT_LINK_TTL_SECONDS,
	identifierFor,
	mintLoginToken,
	TELEGRAM_PROVIDER,
} from "./telegram-link.plugin";
import { AUTH } from "./tokens";

export interface LoginLink {
	readonly url: string;
	readonly expiresAt: Date;
	readonly userId: string;
}

// A telegram account has no email, and better-auth requires one to be unique.
// The placeholder is reserved rather than routable, so a later "add a password"
// flow can replace it without colliding with anything a person could own.
const placeholderEmailFor = (telegramUserId: number): string =>
	`telegram-${telegramUserId}@telegram.invalid`;

@Injectable()
export class TelegramIdentityService {
	constructor(
		@Inject(AUTH) private readonly auth: RecallAuth | undefined,
		@Inject(CONNECTION) private readonly connection: PostgresConnection,
	) {}

	get enabled(): boolean {
		return this.auth !== undefined;
	}

	async issueLoginLink(
		telegramUserId: number,
		displayName?: string,
	): Promise<LoginLink> {
		const auth = this.auth;

		if (auth === undefined) {
			throw new ServiceUnavailableException(
				"identity is not configured on this api",
			);
		}

		const userId = await this.resolveUserId(telegramUserId, displayName);
		const context = await auth.$context;
		const token = mintLoginToken();
		const ttlSeconds =
			loadApiEnvironment().authLinkTtlSeconds ?? DEFAULT_LINK_TTL_SECONDS;
		const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

		await context.internalAdapter.createVerificationValue({
			identifier: identifierFor(token),
			value: userId,
			expiresAt,
		});

		await this.record("telegram-link-issued", userId, String(telegramUserId));

		const url = new URL(
			`${AUTH_BASE_PATH}/telegram/verify`,
			loadApiEnvironment().authBaseUrl,
		);

		url.searchParams.set("token", token);

		return { url: url.href, expiresAt, userId };
	}

	async userIdForTelegram(telegramUserId: number): Promise<string | undefined> {
		const [row] = await this.connection.db
			.select({ userId: account.userId })
			.from(account)
			.where(
				and(
					eq(account.providerId, TELEGRAM_PROVIDER),
					eq(account.accountId, String(telegramUserId)),
				),
			)
			.limit(1);

		return row?.userId;
	}

	private async resolveUserId(
		telegramUserId: number,
		displayName?: string,
	): Promise<string> {
		const existing = await this.userIdForTelegram(telegramUserId);

		if (existing !== undefined) {
			return existing;
		}

		const userId = randomUUID();
		const now = new Date();

		await this.connection.db.transaction(async (transaction) => {
			await transaction.insert(user).values({
				id: userId,
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
				userId,
				createdAt: now,
				updatedAt: now,
			});
		});

		await this.record("telegram-user-created", userId, String(telegramUserId));

		return userId;
	}

	private async record(
		kind: string,
		userId: string | undefined,
		subject: string,
	): Promise<void> {
		await this.connection.db.insert(authEvents).values({
			id: randomUUID(),
			userId: userId ?? null,
			kind,
			subject,
		});
	}
}
