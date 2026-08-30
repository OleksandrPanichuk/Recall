import { beforeEach, describe, expect, test } from "bun:test";
import {
	type OAuthStore,
	TokenKind,
} from "@/infrastructure/auth/oauth-store.types";

export interface OAuthStoreHarness {
	readonly store: OAuthStore;
	readonly owner: string;
	reset(): Promise<void>;
	at(): Date;
	travel(milliseconds: number): void;
}

const uuid = (): string => crypto.randomUUID();

export function describeOAuthStore(
	implementation: string,
	open: () => OAuthStoreHarness,
	options: { readonly skip?: boolean } = {},
): void {
	describe.skipIf(options.skip === true)(
		`the ${implementation} oauth store`,
		() => {
			let harness: OAuthStoreHarness;

			beforeEach(async () => {
				harness = open();
				await harness.reset();
			});

			const aCode = (code: string, ownerId?: string) =>
				harness.store.saveCode(code, {
					clientId: "client-1",
					codeChallenge: "challenge",
					redirectUri: "https://example.test/callback",
					scopes: ["offline_access"],
					expiresAt: new Date(harness.at().getTime() + 60_000),
					ownerId,
				});

			test("round-trips a client", async () => {
				await harness.store.saveClient({
					clientId: "client-1",
					document: '{"client_id":"client-1"}',
				});

				expect(await harness.store.findClient("client-1")).toMatchObject({
					clientId: "client-1",
				});
				expect(await harness.store.findClient("nobody")).toBeUndefined();
			});

			test("a code carries the owner who approved it", async () => {
				const code = uuid();

				await aCode(code, harness.owner);

				expect(await harness.store.findCode(code)).toMatchObject({
					ownerId: harness.owner,
					scopes: ["offline_access"],
				});
			});

			test("a code can be spent once", async () => {
				const code = uuid();

				await aCode(code, harness.owner);

				expect(await harness.store.consumeCode(code)).toBeDefined();
				expect(await harness.store.consumeCode(code)).toBeUndefined();
				expect(await harness.store.findCode(code)).toBeUndefined();
			});

			test("an expired code is not offered", async () => {
				const code = uuid();

				await aCode(code, harness.owner);
				harness.travel(120_000);

				expect(await harness.store.findCode(code)).toBeUndefined();
				expect(await harness.store.consumeCode(code)).toBeUndefined();
			});

			test("a token carries its owner and can be revoked", async () => {
				const token = uuid();

				await harness.store.saveToken(token, TokenKind.Access, {
					clientId: "client-1",
					scopes: ["offline_access"],
					ownerId: harness.owner,
					expiresAt: new Date(harness.at().getTime() + 60_000),
				});

				expect(
					await harness.store.findToken(token, TokenKind.Access),
				).toMatchObject({ ownerId: harness.owner });
				expect(
					await harness.store.findToken(token, TokenKind.Refresh),
				).toBeUndefined();

				await harness.store.revokeToken(token);

				expect(
					await harness.store.findToken(token, TokenKind.Access),
				).toBeUndefined();
			});

			test("a refresh token without an expiry stays valid", async () => {
				const token = uuid();

				await harness.store.saveToken(token, TokenKind.Refresh, {
					clientId: "client-1",
					scopes: ["offline_access"],
					ownerId: harness.owner,
				});
				harness.travel(60 * 60 * 1000);

				expect(
					await harness.store.findToken(token, TokenKind.Refresh),
				).toMatchObject({ ownerId: harness.owner });
			});

			test("an expired access token is not offered", async () => {
				const token = uuid();

				await harness.store.saveToken(token, TokenKind.Access, {
					clientId: "client-1",
					scopes: ["offline_access"],
					ownerId: harness.owner,
					expiresAt: new Date(harness.at().getTime() + 60_000),
				});
				harness.travel(120_000);

				expect(
					await harness.store.findToken(token, TokenKind.Access),
				).toBeUndefined();
			});
		},
	);
}
