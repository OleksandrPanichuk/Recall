import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import {
	createMemoryApplication,
	type MemoryApplication,
} from "@tests/fixtures/application.fixture";
import { createRecordingLogger } from "@tests/fixtures/logger.fixture";
import { createSequentialIdGenerator } from "@tests/fixtures/memory.fixture";
import { createMemoryOAuthStore } from "@tests/fixtures/memory-oauth.store";
import express from "express";
import { createMcpHttpApp } from "./app";
import { createOAuthProvider, type RecallOAuth } from "./oauth/provider";

const STATIC_TOKEN = "s".repeat(40);
const OWNER = "the-owner";
const PASSPHRASE = "correct horse battery staple";
const SIGNED_IN = "session=alice";
const ISSUER_ORIGIN = "http://127.0.0.1";

let application: MemoryApplication;
let oauth: RecallOAuth;
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
	oauth = createOAuthProvider({
		store: createMemoryOAuthStore(() => new Date()),
		staticToken: STATIC_TOKEN,
		instanceOwner: async () => OWNER,
		now: () => new Date(),
	});
	const mcp = createMcpHttpApp({
		useCases: application,
		logger: createRecordingLogger(),
		oauth,
		allowedHosts: [],
		issuer: new URL("http://127.0.0.1/"),
		passphrase: PASSPHRASE,
		sessionOwner: async (request) =>
			request.headers.cookie === SIGNED_IN ? ("alice" as never) : undefined,
	});
	const app = express();

	app.use(mcp);
	app.post("/elsewhere", async (request, response) => {
		const chunks: Buffer[] = [];

		for await (const chunk of request) {
			chunks.push(chunk as Buffer);
		}

		response.json({
			parsed: request.body !== undefined,
			raw: Buffer.concat(chunks).toString("utf8"),
		});
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
			`${origin}/.well-known/oauth-protected-resource/mcp`,
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

	const consentWith = (
		pending: string,
		passphrase: string | undefined,
		headers: Record<string, string> = {},
	) =>
		fetch(`${origin}/consent`, {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				...headers,
			},
			body: new URLSearchParams(
				passphrase === undefined ? { pending } : { pending, passphrase },
			),
			redirect: "manual",
		});

	const pendingFor = async (clientId: string): Promise<string> =>
		new URL(await consentUrlFor(clientId)).searchParams.get(
			"pending",
		) as string;

	const ownerOfGrant = async (
		clientId: string,
		location: string,
	): Promise<unknown> => {
		const code = new URL(location).searchParams.get("code") as string;
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
		).json()) as { access_token: string };

		return (
			(await oauth.provider.verifyAccessToken(tokens.access_token)).extra as {
				ownerId?: unknown;
			}
		).ownerId;
	};

	test("cancels a pending request after five wrong passphrases", async () => {
		const pending = await pendingFor(await register());

		for (let attempt = 1; attempt < 5; attempt += 1) {
			expect((await consentWith(pending, "wrong")).status).toBe(401);
		}

		expect((await consentWith(pending, "wrong")).status).toBe(403);
		expect((await consentWith(pending, PASSPHRASE)).status).toBe(404);
	});

	test("stops listening to an address that keeps guessing", async () => {
		const clientId = await register();

		for (let attempt = 0; attempt < 10; attempt += 1) {
			await consentWith(await pendingFor(clientId), "wrong");
		}

		const pending = await pendingFor(clientId);
		const throttled = await consentWith(pending, PASSPHRASE);

		expect(throttled.status).toBe(429);
		expect(throttled.headers.get("location")).toBeNull();
	});

	test("a signed-in browser consents without the passphrase, and the grant is theirs", async () => {
		const clientId = await register();
		const pending = await pendingFor(clientId);
		const page = await fetch(`${origin}/consent?pending=${pending}`, {
			headers: { cookie: SIGNED_IN },
		});

		expect(await page.text()).not.toContain('name="passphrase"');

		const approved = await consentWith(pending, undefined, {
			cookie: SIGNED_IN,
			origin: ISSUER_ORIGIN,
		});

		expect(approved.status).toBe(302);
		expect(
			await ownerOfGrant(clientId, approved.headers.get("location") as string),
		).toBe("alice");
	});

	test("a throttled address does not stop a signed-in browser", async () => {
		const clientId = await register();

		for (let attempt = 0; attempt < 10; attempt += 1) {
			await consentWith(await pendingFor(clientId), "wrong");
		}

		const approved = await consentWith(await pendingFor(clientId), undefined, {
			cookie: SIGNED_IN,
			origin: ISSUER_ORIGIN,
		});

		expect(approved.status).toBe(302);
	});

	test("the consent page names where access will be sent", async () => {
		const pending = await pendingFor(await register());
		const page = await (
			await fetch(`${origin}/consent?pending=${pending}`)
		).text();

		expect(page).toContain("chatgpt.com");
	});

	test("a session posted from another origin still needs the passphrase", async () => {
		const pending = await pendingFor(await register());

		const refused = await consentWith(pending, undefined, {
			cookie: SIGNED_IN,
			origin: "https://evil.example",
		});

		expect(refused.status).toBe(401);
		expect(refused.headers.get("location")).toBeNull();
	});

	test("a session with no origin header still needs the passphrase", async () => {
		const pending = await pendingFor(await register());

		expect(
			(await consentWith(pending, undefined, { cookie: SIGNED_IN })).status,
		).toBe(401);
	});

	test("the consent page refuses to be framed", async () => {
		const pending = await pendingFor(await register());
		const page = await fetch(`${origin}/consent?pending=${pending}`);

		expect(page.headers.get("x-frame-options")).toBe("DENY");
		expect(page.headers.get("content-security-policy")).toContain(
			"frame-ancestors 'none'",
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

describe("what an mcp client is told before it has a token", () => {
	test("a refusal points at the resource metadata, so discovery can start", async () => {
		const response = await fetch(`${origin}/mcp`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
			},
			body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
		});

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toContain(
			"resource_metadata=",
		);
		expect(response.headers.get("www-authenticate")).toContain(
			"/.well-known/oauth-protected-resource/mcp",
		);
	});

	test("the metadata names the mcp endpoint as the resource, not the origin", async () => {
		const metadata = (await (
			await fetch(`${origin}/.well-known/oauth-protected-resource/mcp`)
		).json()) as { resource: string };

		expect(metadata.resource.endsWith("/mcp")).toBe(true);
	});

	test("a client probing the root is sent to the path the spec uses", async () => {
		const response = await fetch(
			`${origin}/.well-known/oauth-protected-resource`,
			{ redirect: "manual" },
		);

		expect(response.status).toBe(308);
		expect(response.headers.get("location")).toBe(
			"/.well-known/oauth-protected-resource/mcp",
		);
	});

	test("registration is offered, and it issues a client", async () => {
		const discovery = (await (
			await fetch(`${origin}/.well-known/oauth-authorization-server`)
		).json()) as { registration_endpoint?: string };

		expect(discovery.registration_endpoint).toBeDefined();

		expect(discovery.registration_endpoint?.endsWith("/register")).toBe(true);

		const registered = await fetch(`${origin}/register`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				client_name: "probe",
				redirect_uris: ["https://example.test/callback"],
				grant_types: ["authorization_code", "refresh_token"],
				response_types: ["code"],
				token_endpoint_auth_method: "none",
			}),
		});

		expect(registered.status).toBeLessThan(300);
		expect(
			((await registered.json()) as { client_id?: string }).client_id,
		).toBeDefined();
	});
});

describe("body parsing", () => {
	test("leaves a request for another route unread", async () => {
		const response = await fetch(`${origin}/elsewhere`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: "someone@example.com" }),
		});

		expect(await response.json()).toEqual({
			parsed: false,
			raw: '{"email":"someone@example.com"}',
		});
	});

	test("accepts a summary far longer than the default body limit", async () => {
		const summary = `# Long\n\n${"Довгий абзац про щось важливе. ".repeat(5_000)}`;

		expect(Buffer.byteLength(summary)).toBeGreaterThan(100 * 1024);

		const response = await fetch(`${origin}/mcp`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
				authorization: `Bearer ${STATIC_TOKEN}`,
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "tools/call",
				params: {
					name: "quiz_write_summary",
					arguments: { path: ["Books"], summary },
				},
			}),
		});

		expect(response.status).toBe(200);

		const answer = (await response.json()) as {
			result?: { isError?: boolean };
		};

		expect(answer.result?.isError).not.toBe(true);
	});

	test("still refuses a body past its own limit", async () => {
		const response = await fetch(`${origin}/mcp`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
				authorization: `Bearer ${STATIC_TOKEN}`,
			},
			body: JSON.stringify({ padding: "x".repeat(3 * 1024 * 1024) }),
		});

		expect(response.status).toBe(413);
	});
});
