import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { Request } from "express";
import { BotTokenGuard } from "./auth.bot.guard";
import { SessionGuard } from "./auth.session.guard";

const BOT_PREFIX = "/bot/";

@Injectable()
export class SurfaceGuard implements CanActivate {
	constructor(
		private readonly bot: BotTokenGuard,
		private readonly session: SessionGuard,
	) {}

	canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request>();
		const guard = request.path.startsWith(BOT_PREFIX) ? this.bot : this.session;

		return Promise.resolve(guard.canActivate(context));
	}
}
