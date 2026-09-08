import { matchesSecret } from "@recall/kit";

const BEARER = /^Bearer[ \t]+(\S+)[ \t]*$/i;

export class BearerToken {
	static of(header: string | null | undefined): string | undefined {
		if (header === null || header === undefined) {
			return undefined;
		}

		return BEARER.exec(header.trim())?.[1];
	}

	static matches(offered: string, expected: string): boolean {
		return matchesSecret(offered, expected);
	}
}
