import type { CanActivate } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import { setPrincipal } from "@/shared/request-context";
import { AuthService } from "./auth.service";

@Injectable()
export class InstanceOwnerGuard implements CanActivate {
	constructor(private readonly auth: AuthService) {}

	async canActivate(): Promise<boolean> {
		setPrincipal({
			kind: "instance",
			owner: await this.auth.instanceOwner(),
		});

		return true;
	}
}
