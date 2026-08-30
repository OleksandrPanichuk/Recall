import { fromNodeHeaders } from "better-auth/node";
import type { Request } from "express";
import { type OwnerId, toOwnerId } from "@/application/ports/owner";
import type { RecallAuth } from "./build-auth";

export async function ownerOfSession(
	auth: RecallAuth,
	request: Request,
): Promise<OwnerId | undefined> {
	const session = await auth.api.getSession({
		headers: fromNodeHeaders(request.headers),
	});

	return session === null ? undefined : toOwnerId(session.user.id);
}
