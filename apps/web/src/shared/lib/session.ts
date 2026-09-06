import { getRequestHeader } from "@tanstack/react-start/server";
import { apiUrl } from "./api";
import { clientIpHeaders } from "./client-ip";
import { answerFor, type SessionAnswer, type Viewer } from "./session-answer";

export type { Viewer };

export class SessionUnavailableError extends Error {
	constructor(readonly status: number | undefined) {
		super(
			"Could not check whether you are signed in. Your session is intact — try again.",
		);
		this.name = "SessionUnavailableError";
	}
}

const RETRY_DELAY_MS = 250;
const TIMEOUT_MS = 5_000;

const wait = (milliseconds: number): Promise<void> =>
	new Promise((resolve) => {
		setTimeout(resolve, milliseconds);
	});

const ask = async (cookie: string): Promise<SessionAnswer> => {
	let response: Response;

	try {
		response = await fetch(`${apiUrl()}/api/auth/get-session`, {
			headers: { cookie, ...clientIpHeaders() },
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	} catch {
		return { kind: "unknown" };
	}

	return answerFor(
		response.status,
		(await response.json().catch(() => undefined)) as
			| { user?: { id?: string; name?: string } }
			| undefined,
	);
};

export async function viewerOf(): Promise<Viewer | undefined> {
	const cookie = getRequestHeader("cookie");

	if (cookie === undefined) {
		return undefined;
	}

	const first = await ask(cookie);

	if (first.kind !== "unknown") {
		return first.kind === "viewer" ? first.viewer : undefined;
	}

	await wait(RETRY_DELAY_MS);

	const second = await ask(cookie);

	if (second.kind !== "unknown") {
		return second.kind === "viewer" ? second.viewer : undefined;
	}

	throw new SessionUnavailableError(second.status);
}
