import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import type { Request } from "express";
import { type OwnerId, toOwnerId } from "@/core/owner";
import { IdentityNotConfiguredError } from "./auth.errors";
import type { RecallAuth } from "./auth.factory";

export class AuthEngine {
	constructor(private readonly auth: RecallAuth | undefined) {}

	get enabled(): boolean {
		return this.auth !== undefined;
	}

	require(): RecallAuth {
		if (this.auth === undefined) {
			throw new IdentityNotConfiguredError();
		}

		return this.auth;
	}

	handler(): ReturnType<typeof toNodeHandler> | undefined {
		return this.auth === undefined ? undefined : toNodeHandler(this.auth);
	}

	async ownerOfSession(request: Request): Promise<OwnerId | undefined> {
		const session = await this.require().api.getSession({
			headers: fromNodeHeaders(request.headers),
		});

		return session === null ? undefined : toOwnerId(session.user.id);
	}

	async storeVerificationValue(options: {
		readonly identifier: string;
		readonly value: string;
		readonly expiresAt: Date;
	}): Promise<void> {
		const context = await this.require().$context;

		await context.internalAdapter.createVerificationValue(options);
	}
}
