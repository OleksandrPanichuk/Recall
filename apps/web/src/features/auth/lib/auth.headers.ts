import { CLIENT_IP_HEADER } from "@/shared/constants/headers";

export interface AuthHeaderOptions {
	readonly origin: string;
	readonly cookie?: string;
	readonly clientIp?: string;
}

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
