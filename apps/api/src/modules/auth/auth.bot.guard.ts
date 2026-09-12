import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { Request } from "express";
import { loadApiEnvironment } from "@/configs/env.config";
import { BearerToken } from "@/shared/http/bearer.token";
import { setPrincipal } from "@/shared/request-context";
import {
	BotTokenNotConfiguredError,
	ForeignTelegramAccountError,
	WrongBotTokenError,
} from "./auth.errors";
import { AuthService } from "./auth.service";

@Injectable()
export class BotTokenGuard implements CanActivate {
	constructor(private readonly auth: AuthService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const environment = loadApiEnvironment();
		const expected = environment.botToken;

		if (expected === undefined) {
			throw new BotTokenNotConfiguredError();
		}

		const request = context.switchToHttp().getRequest<Request>();
		const offered = BearerToken.of(request.headers.authorization);

		if (offered === undefined || !BearerToken.matches(offered, expected)) {
			throw new WrongBotTokenError();
		}

		const named = (request.body as { telegramUserId?: unknown } | undefined)
			?.telegramUserId;

		if (named !== undefined && named !== environment.allowedTelegramUserId) {
			throw new ForeignTelegramAccountError();
		}

		const owner = await this.auth.instanceOwner().catch(() => undefined);

		if (owner !== undefined) {
			setPrincipal({ kind: "instance", owner });
		}

		return true;
	}
}
