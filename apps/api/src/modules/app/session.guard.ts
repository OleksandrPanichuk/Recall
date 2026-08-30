import {
	type CanActivate,
	type ExecutionContext,
	Inject,
	Injectable,
	ServiceUnavailableException,
	UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import type { OwnerId } from "@/application/ports/owner";
import type { RecallAuth } from "@/modules/auth/build-auth";
import { ownerOfSession } from "@/modules/auth/session-owner";
import { AUTH } from "@/modules/auth/tokens";

export interface SessionRequest extends Request {
	owner?: OwnerId;
}

@Injectable()
export class SessionGuard implements CanActivate {
	constructor(@Inject(AUTH) private readonly auth: RecallAuth | undefined) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		if (this.auth === undefined) {
			throw new ServiceUnavailableException(
				"identity is not configured on this api",
			);
		}

		const request = context.switchToHttp().getRequest<SessionRequest>();
		const owner = await ownerOfSession(this.auth, request);

		if (owner === undefined) {
			throw new UnauthorizedException("sign in first");
		}

		request.owner = owner;

		return true;
	}
}
