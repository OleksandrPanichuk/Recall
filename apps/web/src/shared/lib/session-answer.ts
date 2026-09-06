export interface Viewer {
	readonly id: string;
	readonly name: string;
}

export type SessionAnswer =
	| { readonly kind: "viewer"; readonly viewer: Viewer }
	| { readonly kind: "anonymous" }
	| { readonly kind: "unknown"; readonly status?: number };

interface SessionBody {
	readonly user?: { readonly id?: string; readonly name?: string };
}

export function answerFor(
	status: number,
	body: SessionBody | null | undefined,
): SessionAnswer {
	if (status === 401) {
		return { kind: "anonymous" };
	}

	if (status < 200 || status > 299) {
		return { kind: "unknown", status };
	}

	if (body === undefined) {
		return { kind: "unknown", status };
	}

	const user = body?.user;

	return user?.id === undefined
		? { kind: "anonymous" }
		: { kind: "viewer", viewer: { id: user.id, name: user.name ?? "You" } };
}
