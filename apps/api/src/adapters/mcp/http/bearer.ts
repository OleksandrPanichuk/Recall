import { createHash, timingSafeEqual } from "node:crypto";

const BEARER = /^Bearer[ \t]+(\S+)[ \t]*$/i;

const digestOf = (value: string): Buffer =>
	createHash("sha256").update(value, "utf8").digest();

export function bearerTokenOf(header: string | null): string | undefined {
	if (header === null) {
		return undefined;
	}

	return BEARER.exec(header.trim())?.[1];
}

export function matchesToken(presented: string, expected: string): boolean {
	if (presented.length === 0) {
		return false;
	}

	return timingSafeEqual(digestOf(presented), digestOf(expected));
}
