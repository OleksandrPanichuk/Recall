import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	type AppSession,
	openAppSession,
	postgresAvailable,
} from "../../fixtures/app-session";

const available = await postgresAvailable();
const MCP_TOKEN = "m".repeat(40);
const EMAIL = "long-summaries@example.com";
const PASSWORD = "a passphrase long enough";

let session: AppSession;

beforeAll(async () => {
	if (!available) {
		return;
	}

	session = await openAppSession({
		name: "mcp-beside-auth",
		env: {
			MCP_HTTP_TOKEN: MCP_TOKEN,
			MCP_OAUTH_ISSUER: "http://127.0.0.1/",
			MCP_OAUTH_PASSPHRASE: "a consent passphrase",
		},
	});
});

afterAll(async () => {
	await session?.close();
});

const callTool = (name: string, args: Record<string, unknown>) =>
	fetch(`${session.origin}/mcp`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			accept: "application/json, text/event-stream",
			authorization: `Bearer ${MCP_TOKEN}`,
		},
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method: "tools/call",
			params: { name, arguments: args },
		}),
	});

describe.skipIf(!available)(
	"the mcp surface mounted beside better auth",
	() => {
		test("better auth still signs someone up and in", async () => {
			expect(await session.signUp(EMAIL, PASSWORD)).not.toBe("");

			const signedIn = await fetch(`${session.origin}/api/auth/sign-in/email`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
			});

			expect(signedIn.status).toBe(200);

			const cookie = (signedIn.headers.get("set-cookie") ?? "").split(";")[0];
			const current = (await (
				await fetch(`${session.origin}/api/auth/get-session`, {
					headers: { cookie: cookie ?? "" },
				})
			).json()) as { user?: { email?: string } } | null;

			expect(current?.user?.email).toBe(EMAIL);
		});

		test("the rest of the api still reads its own json bodies", async () => {
			const issued = await session.app("auth/tokens/issue", { name: "Claude" });

			expect(issued.status).toBeLessThan(300);
			expect(((await issued.json()) as { name?: string }).name).toBe("Claude");
		});

		test("a summary longer than the default body limit is written whole", async () => {
			const summary = `# Long\n\n${"Довгий абзац про щось важливе. ".repeat(5_000)}`;

			expect(Buffer.byteLength(summary)).toBeGreaterThan(100 * 1024);

			const written = await callTool("quiz_write_summary", {
				path: ["Long reads"],
				summary,
			});

			expect(written.status).toBe(200);

			const read = (await (
				await callTool("quiz_read_summary", { path: ["Long reads"] })
			).json()) as {
				result?: { structuredContent?: { summary?: string } };
			};

			expect(read.result?.structuredContent?.summary).toBe(summary.trim());
		});
	},
);
