export interface AuthHeaderOptions {
	readonly origin: string;
	readonly cookie?: string;
	readonly clientIp?: string;
}

export const CLIENT_IP_HEADER = "x-recall-client-ip";

export function authHeaders(
	options: AuthHeaderOptions,
): Readonly<Record<string, string>> {
	return {
		"content-type": "application/json",
		origin: options.origin,
		...(options.cookie === undefined ? {} : { cookie: options.cookie }),
		...(options.clientIp === undefined
			? {}
			: { [CLIENT_IP_HEADER]: options.clientIp }),
	};
}
