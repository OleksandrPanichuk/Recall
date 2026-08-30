import { randomUUID } from "node:crypto";
import {
	Inject,
	Injectable,
	ServiceUnavailableException,
} from "@nestjs/common";
import { authEvents } from "@/persistence/postgres/auth-schema";
import type { PostgresConnection } from "@/persistence/postgres/client";
import {
	ensureTelegramOwner,
	findTelegramOwner,
} from "@/persistence/postgres/owner";
import { loadApiEnvironment } from "../shared/config/api-env";
import { CONNECTION } from "../shared/database/tokens";
import { AUTH_BASE_PATH, type RecallAuth } from "./build-auth";
import {
	DEFAULT_LINK_TTL_SECONDS,
	identifierFor,
	mintLoginToken,
} from "./telegram-link.plugin";
import { AUTH } from "./tokens";

export interface LoginLink {
	readonly url: string;
	readonly expiresAt: Date;
	readonly userId: string;
}

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

	userIdForTelegram(telegramUserId: number): Promise<string | undefined> {
		return findTelegramOwner(this.connection.db, telegramUserId);
	}

	private async resolveUserId(
		telegramUserId: number,
		displayName?: string,
	): Promise<string> {
		const existing = await this.userIdForTelegram(telegramUserId);

		if (existing !== undefined) {
			return existing;
		}

		const owner = await ensureTelegramOwner(
			this.connection.db,
			telegramUserId,
			displayName,
		);

		await this.record("telegram-user-created", owner, String(telegramUserId));

		return owner;
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
