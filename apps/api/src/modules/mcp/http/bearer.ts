import { BearerToken } from "@/shared/http/bearer.token";

export const bearerTokenOf = (header: string | null): string | undefined =>
	BearerToken.of(header);

export const matchesToken = (offered: string, expected: string): boolean =>
	BearerToken.matches(offered, expected);
