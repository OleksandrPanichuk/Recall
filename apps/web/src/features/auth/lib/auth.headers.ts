export interface AuthHeaderOptions {
	readonly origin: string;
	readonly cookie?: string;
}

export function authHeaders(
	options: AuthHeaderOptions,
): Readonly<Record<string, string>> {
	return {
		"content-type": "application/json",
		origin: options.origin,
		...(options.cookie === undefined ? {} : { cookie: options.cookie }),
	};
}
