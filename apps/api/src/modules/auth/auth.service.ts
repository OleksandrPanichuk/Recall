import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Request } from "express";
import { loadApiEnvironment } from "@/configs/env.config";
import type { OwnerId } from "@/core/owner";
import { Transaction } from "@/core/transaction";
import { UsersService } from "@/modules/users";
import { AccountEntity } from "./account.entity";
import { AuthEngine } from "./auth.engine";
import {
	InstanceHasNoOwnerError,
	TelegramAccountNotLinkedError,
} from "./auth.errors";
import { AuthRepository } from "./auth.repository";

@Injectable()
export class AuthService {
	private instanceOwnerId: OwnerId | undefined;

	constructor(
		private readonly repository: AuthRepository,
		private readonly users: UsersService,
		private readonly engine: AuthEngine,
		private readonly transaction: Transaction,
	) {}

	get enabled(): boolean {
		return this.engine.enabled;
	}

	ownerOfSession(request: Request): Promise<OwnerId | undefined> {
		return this.engine.ownerOfSession(request);
	}

	findOwnerForTelegram(telegramUserId: number): Promise<OwnerId | undefined> {
		return this.repository.findOwnerByAccount(
			AccountEntity.TELEGRAM_PROVIDER,
			AccountEntity.telegramAccountId(telegramUserId),
		);
	}

	async requireOwnerForTelegram(telegramUserId: number): Promise<OwnerId> {
		const owner = await this.findOwnerForTelegram(telegramUserId);

		if (owner === undefined) {
			throw new TelegramAccountNotLinkedError();
		}

		return owner;
	}

	async ensureOwnerForTelegram(
		telegramUserId: number,
		displayName?: string,
	): Promise<OwnerId> {
		const existing = await this.findOwnerForTelegram(telegramUserId);

		if (existing !== undefined) {
			return existing;
		}

		const owner = await this.transaction.run(async () => {
			const at = new Date();
			const created = await this.users.create({
				id: randomUUID(),
				name: AccountEntity.displayNameFor(telegramUserId, displayName),
				email: AccountEntity.placeholderEmailFor(telegramUserId),
				at,
			});

			await this.repository.linkAccount({
				id: randomUUID(),
				ownerId: created,
				providerId: AccountEntity.TELEGRAM_PROVIDER,
				accountId: AccountEntity.telegramAccountId(telegramUserId),
				at,
			});

			return created;
		});

		await this.recordEvent(
			"telegram-user-created",
			AccountEntity.telegramAccountId(telegramUserId),
			owner,
		);

		return owner;
	}

	async instanceOwner(): Promise<OwnerId> {
		if (this.instanceOwnerId !== undefined) {
			return this.instanceOwnerId;
		}

		const telegramUserId = loadApiEnvironment().allowedTelegramUserId;

		if (telegramUserId === 0) {
			throw new InstanceHasNoOwnerError(
				"ALLOWED_TELEGRAM_USER_ID is not set, so this api has no owner",
			);
		}

		const owner = await this.findOwnerForTelegram(telegramUserId);

		if (owner === undefined) {
			throw new InstanceHasNoOwnerError(
				"no owner has linked this instance yet — send /login to the bot first",
			);
		}

		this.instanceOwnerId = owner;

		return owner;
	}

	recordEvent(kind: string, subject: string, ownerId?: OwnerId): Promise<void> {
		return this.repository.recordEvent({
			id: randomUUID(),
			kind,
			subject,
			ownerId,
		});
	}

	storeVerificationValue(options: {
		readonly identifier: string;
		readonly value: string;
		readonly expiresAt: Date;
	}): Promise<void> {
		return this.engine.storeVerificationValue(options);
	}
}
