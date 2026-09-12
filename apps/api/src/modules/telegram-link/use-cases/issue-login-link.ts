import { Injectable } from "@nestjs/common";
import { loadApiEnvironment } from "@/configs/env.config";
import { UseCase } from "@/core/use-case";
import {
	AUTH_BASE_PATH,
	AuthService,
	IdentityNotConfiguredError,
} from "@/modules/auth";
import { DEFAULT_LINK_TTL_SECONDS, LoginToken } from "../telegram-link.plugin";

export interface IssueLoginLinkUseCaseOptions {
	readonly telegramUserId: number;
	readonly displayName?: string;
}

export interface LoginLink {
	readonly url: string;
	readonly expiresAt: Date;
	readonly userId: string;
}

type Options = IssueLoginLinkUseCaseOptions;
type Result = LoginLink;

@Injectable()
export class IssueLoginLinkUseCase extends UseCase<Options, Result> {
	constructor(private readonly auth: AuthService) {
		super();
	}

	async execute({ telegramUserId, displayName }: Options): Promise<Result> {
		if (!this.auth.enabled) {
			throw new IdentityNotConfiguredError();
		}

		const environment = loadApiEnvironment();
		const userId = await this.auth.ensureOwnerForTelegram(
			telegramUserId,
			displayName,
		);
		const token = LoginToken.mint();
		const ttlSeconds =
			environment.authLinkTtlSeconds ?? DEFAULT_LINK_TTL_SECONDS;
		const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

		await this.auth.storeVerificationValue({
			identifier: LoginToken.identifierFor(token),
			value: userId,
			expiresAt,
		});

		await this.auth.recordEvent(
			"telegram-link-issued",
			String(telegramUserId),
			userId,
		);

		const url = new URL(
			`${AUTH_BASE_PATH}/telegram/verify`,
			environment.authBaseUrl,
		);

		url.searchParams.set("token", token);

		return { url: url.href, expiresAt, userId };
	}
}
