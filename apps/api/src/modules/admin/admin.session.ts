import {
	createHmac,
	randomBytes,
	scryptSync,
	timingSafeEqual,
} from "node:crypto";

export const SESSION_COOKIE = "admin";
const COOKIE_PATH = "/";

const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const ID_BYTES = 18;

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

const flags = (maxAgeSeconds: number, secure: boolean): readonly string[] => [
	`Path=${COOKIE_PATH}`,
	`Max-Age=${maxAgeSeconds}`,
	"HttpOnly",
	"SameSite=Strict",
	...(secure ? ["Secure"] : []),
];

interface Presented {
	readonly id: string;
	readonly expiresAt: number;
}

export class AdminSessions {
	private readonly key: Buffer;
	private readonly live = new Map<string, number>();

	constructor(passphrase: string) {
		this.key = scryptSync(passphrase, randomBytes(SALT_BYTES), KEY_BYTES);
	}

	static cleared(secure = false): string {
		return [`${SESSION_COOKIE}=`, ...flags(0, secure)].join("; ");
	}

	issue(now: Date, secure = false): string {
		this.forgetExpired(now.getTime());

		const id = randomBytes(ID_BYTES).toString("base64url");
		const expiresAt = now.getTime() + SESSION_LIFETIME_MS;
		const payload = `${id}.${expiresAt}`;

		this.live.set(id, expiresAt);

		return [
			`${SESSION_COOKIE}=${payload}.${this.signatureOf(payload)}`,
			...flags(Math.floor(SESSION_LIFETIME_MS / 1000), secure),
		].join("; ");
	}

	read(header: string | undefined, now: Date): boolean {
		const presented = this.presentedIn(header);

		return (
			presented !== undefined &&
			presented.expiresAt > now.getTime() &&
			this.live.get(presented.id) === presented.expiresAt
		);
	}

	end(header: string | undefined): void {
		const presented = this.presentedIn(header);

		if (presented !== undefined) {
			this.live.delete(presented.id);
		}
	}

	private presentedIn(header: string | undefined): Presented | undefined {
		if (header === undefined || header.length === 0) {
			return undefined;
		}

		const [id, expiry, signature, ...rest] = (
			cookieValue(header, SESSION_COOKIE) ?? ""
		).split(".");

		if (
			id === undefined ||
			id.length === 0 ||
			expiry === undefined ||
			signature === undefined ||
			rest.length > 0 ||
			!sameSignature(signature, this.signatureOf(`${id}.${expiry}`))
		) {
			return undefined;
		}

		const expiresAt = Number(expiry);

		return Number.isFinite(expiresAt) ? { id, expiresAt } : undefined;
	}

	private signatureOf(payload: string): string {
		return createHmac("sha256", this.key).update(payload).digest("base64url");
	}

	private forgetExpired(now: number): void {
		for (const [id, expiresAt] of this.live) {
			if (expiresAt <= now) {
				this.live.delete(id);
			}
		}
	}
}
