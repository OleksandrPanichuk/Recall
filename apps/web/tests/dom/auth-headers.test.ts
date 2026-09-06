import { describe, expect, test } from "bun:test";
import {
	authHeaders,
	CLIENT_IP_HEADER,
} from "@/features/auth/lib/auth.headers";

const WEB = "http://127.0.0.1:3000";

describe("what the web sends to the auth api", () => {
	test("an origin, because a signed-in call without one is refused 403", () => {
		expect(authHeaders({ origin: WEB }).origin).toBe(WEB);
	});

	test("the origin is the web app's own, which the api trusts", () => {
		expect(authHeaders({ origin: "https://recall.example" }).origin).toBe(
			"https://recall.example",
		);
	});

	test("json, always", () => {
		expect(authHeaders({ origin: WEB })["content-type"]).toBe(
			"application/json",
		);
	});

	test("the cookie only when the call is made on someone's behalf", () => {
		expect(authHeaders({ origin: WEB }).cookie).toBeUndefined();
		expect(authHeaders({ origin: WEB, cookie: "a=b" }).cookie).toBe("a=b");
	});

	test("the client ip only when the runtime could resolve one", () => {
		expect(authHeaders({ origin: WEB })[CLIENT_IP_HEADER]).toBeUndefined();
		expect(
			authHeaders({ origin: WEB, clientIp: "203.0.113.7" })[CLIENT_IP_HEADER],
		).toBe("203.0.113.7");
	});
});
