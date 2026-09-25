import { getRequestIP } from "@tanstack/react-start/server";
import { CLIENT_IP_HEADER } from "@/shared/constants/headers";

const trustsProxy = (): boolean => process.env.TRUST_PROXY === "on";

export function clientIpHeaders(): Readonly<Record<string, string>> {
	const ip = getRequestIP({ xForwardedFor: trustsProxy() });

	return ip === undefined ? {} : { [CLIENT_IP_HEADER]: ip };
}
