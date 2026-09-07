import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { OwnerId } from "@/core/owner";
import { setPrincipal } from "@/shared/request-context";
import { NotSignedInError } from "./auth.errors";
import { AuthService } from "./auth.service";

export interface SessionRequest extends Request {
	owner?: OwnerId;
}

@Injectable()
export class SessionGuard implements CanActivate {
	constructor(private readonly auth: AuthService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<SessionRequest>();
		const owner = await this.auth.ownerOfSession(request);

		if (owner === undefined) {
			throw new NotSignedInError();
		}

		request.owner = owner;
		setPrincipal({ kind: "session", owner });

		return true;
	}
}
