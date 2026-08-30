import { createHash, timingSafeEqual } from "node:crypto";

const digestOf = (value: string): Buffer =>
	createHash("sha256").update(value, "utf8").digest();

export function matchesSecret(presented: string, expected: string): boolean {
	if (presented.length === 0 || expected.length === 0) {
		return false;
	}

	return timingSafeEqual(digestOf(presented), digestOf(expected));
}
