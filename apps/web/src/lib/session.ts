import { getRequestHeader } from "@tanstack/react-start/server";
import { apiUrl } from "./api";

export interface Viewer {
	readonly id: string;
	readonly name: string;
}

// Asked of the api rather than decoded here: the cookie is signed with a secret
// this app does not have, and should not.
export async function viewerOf(): Promise<Viewer | undefined> {
	const cookie = getRequestHeader("cookie");

	if (cookie === undefined) {
		return undefined;
	}

	const response = await fetch(`${apiUrl()}/api/auth/get-session`, {
		headers: { cookie },
	});

	if (!response.ok) {
		return undefined;
	}

	const body = (await response.json().catch(() => null)) as {
		user?: { id?: string; name?: string };
	} | null;

	return body?.user?.id === undefined
		? undefined
		: { id: body.user.id, name: body.user.name ?? "You" };
}
