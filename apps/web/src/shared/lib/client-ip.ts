import { getRequestIP } from "@tanstack/react-start/server";
import { vouchedClientHeaders } from "./client-ip.headers";

const trustsProxy = (): boolean => process.env.TRUST_PROXY === "on";

export function clientIpHeaders(): Readonly<Record<string, string>> {
	return vouchedClientHeaders({
		ip: getRequestIP({ xForwardedFor: trustsProxy() }),
		secret: process.env.AUTH_CLIENT_IP_SECRET,
	});
}
