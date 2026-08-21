import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "admin";
const COOKIE_PATH = "/";

const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;

const signatureOf = (expiry: string, secret: string): string =>
	createHmac("sha256", secret).update(expiry).digest("base64url");

const sameSignature = (offered: string, expected: string): boolean => {
	const left = Buffer.from(offered);
	const right = Buffer.from(expected);

	return left.length === right.length && timingSafeEqual(left, right);
};

const cookieValue = (header: string, name: string): string | undefined => {
	for (const part of header.split(";")) {
		const [key, ...rest] = part.trim().split("=");

		if (key === name) {
			return rest.join("=");
		}
	}

	return undefined;
};

export function issueSession(secret: string, now: Date): string {
	const expiry = String(now.getTime() + SESSION_LIFETIME_MS);
	const value = `${expiry}.${signatureOf(expiry, secret)}`;

	return [
		`${SESSION_COOKIE}=${value}`,
		`Path=${COOKIE_PATH}`,
		`Max-Age=${Math.floor(SESSION_LIFETIME_MS / 1000)}`,
		"HttpOnly",
		"SameSite=Strict",
	].join("; ");
}

export function clearSession(): string {
	return [
		`${SESSION_COOKIE}=`,
		`Path=${COOKIE_PATH}`,
		"Max-Age=0",
		"HttpOnly",
		"SameSite=Strict",
	].join("; ");
}

export function readSession(
	header: string | undefined,
	secret: string,
	now: Date,
): boolean {
	if (header === undefined || header.length === 0) {
		return false;
	}

	const value = cookieValue(header, SESSION_COOKIE);

	if (value === undefined) {
		return false;
	}

	const [expiry, signature] = value.split(".");

	if (expiry === undefined || signature === undefined) {
		return false;
	}

	if (!sameSignature(signature, signatureOf(expiry, secret))) {
		return false;
	}

	return Number(expiry) > now.getTime();
}
