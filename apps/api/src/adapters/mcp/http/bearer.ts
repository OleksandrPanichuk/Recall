import { matchesSecret } from "@recall/kit";

const BEARER = /^Bearer[ \t]+(\S+)[ \t]*$/i;

export function bearerTokenOf(header: string | null): string | undefined {
	if (header === null) {
		return undefined;
	}

	return BEARER.exec(header.trim())?.[1];
}

export const matchesToken = matchesSecret;
