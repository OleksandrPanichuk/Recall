import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import {
	createMemoryApplication,
	type MemoryApplication,
} from "@tests/fixtures/application.fixture";
import { createRecordingLogger } from "@tests/fixtures/logger.fixture";
import { createSequentialIdGenerator } from "@tests/fixtures/memory.fixture";
import {
	createOAuthDatabase,
	type OAuthDatabase,
} from "@/adapters/persistence/sqlite/oauth-database";
import { createSqliteOAuthStore } from "@/adapters/persistence/sqlite/repositories/sqlite-oauth.store";
import { createMcpHttpApp } from "./app";
import { createOAuthProvider } from "./oauth/provider";

const STATIC_TOKEN = "s".repeat(40);
const OWNER = "the-owner";
const PASSPHRASE = "correct horse battery staple";

let application: MemoryApplication;
let oauthDatabase: OAuthDatabase;
let listener: Server;
let origin: string;

const rpc = (method: string) =>
	JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: {} });

const callMcp = (token?: string): Promise<globalThis.Response> =>
	fetch(`${origin}/mcp`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json, text/event-stream",
			...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
		},
		body: rpc("tools/list"),
	});

beforeEach(async () => {
	application = createMemoryApplication({
		idGenerator: createSequentialIdGenerator("q"),
	});
	oauthDatabase = createOAuthDatabase(":memory:");

	const oauth = createOAuthProvider({
		store: createSqliteOAuthStore(
			oauthDatabase.client,
			oauthDatabase.transaction,
			() => new Date(),
		),
		staticToken: STATIC_TOKEN,
		instanceOwner: async () => OWNER,
		now: () => new Date(),
	});
	const app = createMcpHttpApp({
		applicationFor: () => application,
		logger: createRecordingLogger(),
		oauth,
		allowedHosts: [],
		issuer: new URL("http://127.0.0.1/"),
		passphrase: PASSPHRASE,
	});

	await new Promise<void>((resolve) => {
		listener = app.listen(0, "127.0.0.1", () => {
			const address = listener.address();

			origin =
				typeof address === "object" && address !== null
					? `http://127.0.0.1:${address.port}`
					: "";
			resolve();
		});
	});
});

afterEach(async () => {
	await new Promise<void>((resolve) => {
		listener.close(() => resolve());
	});
	oauthDatabase.close();
	await application.close();
});

describe("the protected endpoint", () => {
	test("refuses a request with no token", async () => {
		expect((await callMcp()).status).toBe(401);
	});

	test("refuses a token it never issued", async () => {
		expect((await callMcp("x".repeat(40))).status).toBe(401);
	});

	test("still serves the static token, as part A did", async () => {
		const response = await callMcp(STATIC_TOKEN);

		expect(response.status).toBe(200);
		expect(JSON.stringify(await response.json())).toContain("quiz_create_set");
	});
});

describe("discovery", () => {
	test("advertises the authorization server and offline access", async () => {
		const metadata = (await (
			await fetch(`${origin}/.well-known/oauth-authorization-server`)
		).json()) as Record<string, never>;

		expect(String(metadata.registration_endpoint)).toContain("/register");
		expect(metadata.scopes_supported as unknown as string[]).toContain(
			"offline_access",
		);
		expect(
			metadata.code_challenge_methods_supported as unknown as string[],
		).toContain("S256");
	});

	test("advertises where the protected resource keeps its authorization server", async () => {
		const response = await fetch(
			`${origin}/.well-known/oauth-protected-resource`,
		);

		expect(response.status).toBe(200);
	});
});

describe("the whole grant, as a client would walk it", () => {
	const register = async (): Promise<string> => {
		const response = await fetch(`${origin}/register`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				client_name: "ChatGPT",
				redirect_uris: [
					"https://chatgpt.com/connector_platform_oauth_redirect",
				],
				grant_types: ["authorization_code", "refresh_token"],
				response_types: ["code"],
				token_endpoint_auth_method: "none",
			}),
		});

		expect(response.status).toBeLessThan(300);

		return ((await response.json()) as { client_id: string }).client_id;
	};

	const consentUrlFor = async (clientId: string): Promise<string> => {
		const authorize = new URL(`${origin}/authorize`);

		authorize.searchParams.set("client_id", clientId);
		authorize.searchParams.set("response_type", "code");
		authorize.searchParams.set(
			"redirect_uri",
			"https://chatgpt.com/connector_platform_oauth_redirect",
		);
		authorize.searchParams.set(
			"code_challenge",
			"E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
		);
		authorize.searchParams.set("code_challenge_method", "S256");
		authorize.searchParams.set("state", "state-1");
		authorize.searchParams.set("scope", "offline_access");

		const response = await fetch(authorize, { redirect: "manual" });

		expect(response.status).toBe(302);

		return new URL(response.headers.get("location") as string, origin).href;
	};

	test("registers, consents with the passphrase, and exchanges a code", async () => {
		const clientId = await register();
		const consentUrl = await consentUrlFor(clientId);

		expect((await fetch(consentUrl)).status).toBe(200);

		const pending = new URL(consentUrl).searchParams.get("pending") as string;
		const approved = await fetch(`${origin}/consent`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ pending, passphrase: PASSPHRASE }),
			redirect: "manual",
		});

		expect(approved.status).toBe(302);

		const code = new URL(
			approved.headers.get("location") as string,
		).searchParams.get("code") as string;

		const tokens = (await (
			await fetch(`${origin}/token`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "authorization_code",
					code,
					client_id: clientId,
					redirect_uri: "https://chatgpt.com/connector_platform_oauth_redirect",
					code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
				}),
			})
		).json()) as { access_token: string; refresh_token?: string };

		expect(tokens.access_token).toBeTruthy();
		expect(tokens.refresh_token).toBeTruthy();

		const authorised = await callMcp(tokens.access_token);

		expect(authorised.status).toBe(200);
		expect(JSON.stringify(await authorised.json())).toContain(
			"quiz_create_set",
		);
	});

	test("refuses the wrong passphrase and issues nothing", async () => {
		const clientId = await register();
		const consentUrl = await consentUrlFor(clientId);
		const pending = new URL(consentUrl).searchParams.get("pending") as string;

		const refused = await fetch(`${origin}/consent`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ pending, passphrase: "wrong" }),
			redirect: "manual",
		});

		expect(refused.status).toBe(401);
		expect(refused.headers.get("location")).toBeNull();
	});
});
