import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { Request } from "express";
import { loadApiEnvironment } from "@/configs/env.config";
import { BearerToken } from "@/shared/http/bearer.token";
import {
	BotTokenNotConfiguredError,
	ForeignTelegramAccountError,
	WrongBotTokenError,
} from "./auth.errors";

@Injectable()
export class BotTokenGuard implements CanActivate {
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

		return true;
	}
}
