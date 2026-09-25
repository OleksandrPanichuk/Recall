import {
	CLIENT_IP_HEADER,
	CLIENT_IP_SECRET_HEADER,
} from "@/shared/constants/headers";

export interface VouchedClient {
	readonly ip?: string;
	readonly secret?: string;
}

export function vouchedClientHeaders(
	client: VouchedClient,
): Readonly<Record<string, string>> {
	const secret = client.secret?.trim();

	if (client.ip === undefined || secret === undefined || secret.length === 0) {
		return {};
	}

	return { [CLIENT_IP_HEADER]: client.ip, [CLIENT_IP_SECRET_HEADER]: secret };
}
