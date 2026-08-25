import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
	UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { bearerTokenOf, matchesToken } from "@/adapters/mcp/http/bearer";
import { loadApiEnvironment } from "../shared/config/api-env";

@Injectable()
export class BotTokenGuard implements CanActivate {
	canActivate(context: ExecutionContext): boolean {
		const expected = loadApiEnvironment().botToken;

		if (expected === undefined) {
			throw new UnauthorizedException("the bot surface is not configured");
		}

		const request = context.switchToHttp().getRequest<Request>();
		const offered = bearerTokenOf(request.headers.authorization ?? null);

		if (offered === undefined || !matchesToken(offered, expected)) {
			throw new UnauthorizedException("that token is not the bot's token");
		}

		return true;
	}
}
