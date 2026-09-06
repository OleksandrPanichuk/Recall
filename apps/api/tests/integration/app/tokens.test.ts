import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	type AppSession,
	bodyOf as json,
	openAppSession,
	postgresAvailable,
} from "../../fixtures/app-session";

const available = await postgresAvailable();
const STRANGER = "stranger@example.com";
const PASSWORD = "a passphrase long enough";

let session: AppSession;
let owner: string;
let stranger: string;
let asOwner: AppSession["app"];
let asStranger: AppSession["app"];

beforeAll(async () => {
	if (!available) {
		return;
	}

	session = await openAppSession({ name: "app-tokens" });
	owner = session.cookie;
	stranger = await session.signUp(STRANGER, PASSWORD);
	asOwner = session.app;
	asStranger = session.as(stranger);
});

afterAll(async () => {
	await session?.close();
});

describe.skipIf(!available)("minting an mcp token from the web", () => {
	let tokenId: string;
	let secret: string;

	test("both accounts really are signed in", () => {
		expect(owner).not.toBe("");
		expect(stranger).not.toBe("");
		expect(owner).not.toBe(stranger);
	});

	test("a session mints a token without naming anyone", async () => {
		const response = await asOwner("auth/tokens/issue", { name: "Claude" });

		expect(response.status).toBe(200);

		const issued = await json<{ id: string; name: string; token: string }>(
			response,
		);

		expect(issued.name).toBe("Claude");
		expect(issued.token.startsWith("recall_pat_")).toBe(true);

		tokenId = issued.id;
		secret = issued.token;
	});

	test("the secret is shown once and never listed again", async () => {
		const listed = await json<Record<string, unknown>[]>(
			await asOwner("auth/tokens/list"),
		);

		expect(listed).toHaveLength(1);
		expect(listed[0]?.id).toBe(tokenId);
		expect(listed[0]).not.toHaveProperty("token");
		expect(JSON.stringify(listed)).not.toContain(secret);
	});

	test("the bot surface sees the same token, because it is the same owner", async () => {
		const listed = await json<{ id: string }[]>(
			await session.bot("auth/tokens/list", {
				telegramUserId: session.telegramUserId,
			}),
		);

		expect(listed.map((token) => token.id)).toContain(tokenId);
	});

	test("another account sees none of it", async () => {
		const listed = await json<unknown[]>(await asStranger("auth/tokens/list"));

		expect(listed).toEqual([]);
	});

	test("another account cannot revoke it either", async () => {
		const refused = await json<{ revoked: boolean }>(
			await asStranger("auth/tokens/revoke", { tokenId }),
		);

		expect(refused.revoked).toBe(false);

		const still = await json<unknown[]>(await asOwner("auth/tokens/list"));

		expect(still).toHaveLength(1);
	});

	test("its owner can revoke it, and then it is gone", async () => {
		const gone = await json<{ revoked: boolean }>(
			await asOwner("auth/tokens/revoke", { tokenId }),
		);

		expect(gone.revoked).toBe(true);
		expect(await json<unknown[]>(await asOwner("auth/tokens/list"))).toEqual(
			[],
		);
	});

	test("no session at all is refused", async () => {
		const response = await fetch(`${session.origin}/app/auth/tokens/list`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{}",
		});

		expect(response.ok).toBe(false);
	});

	test("a telegram id in the body is ignored, not honoured", async () => {
		const issued = await json<{ id: string }>(
			await asStranger("auth/tokens/issue", {
				name: "sneaky",
				telegramUserId: session.telegramUserId,
			}),
		);
		const mine = await json<{ id: string }[]>(
			await asStranger("auth/tokens/list"),
		);
		const theirs = await json<unknown[]>(await asOwner("auth/tokens/list"));

		expect(mine.map((token) => token.id)).toEqual([issued.id]);
		expect(theirs).toEqual([]);
	});
});
