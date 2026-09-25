import { describe, expect, test } from "bun:test";
import { authHeaders } from "@/features/auth/lib/auth.headers";
import {
	CLIENT_IP_HEADER,
	CLIENT_IP_SECRET_HEADER,
} from "@/shared/constants/headers";
import { vouchedClientHeaders } from "@/shared/lib/client-ip.headers";

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

	test("the client ip only together with the secret that makes the api believe it", () => {
		expect(
			vouchedClientHeaders({ ip: "203.0.113.7", secret: "s".repeat(32) }),
		).toEqual({
			[CLIENT_IP_HEADER]: "203.0.113.7",
			[CLIENT_IP_SECRET_HEADER]: "s".repeat(32),
		});
	});

	test("no client ip at all when there is no secret to vouch for it", () => {
		expect(vouchedClientHeaders({ ip: "203.0.113.7" })).toEqual({});
		expect(vouchedClientHeaders({ ip: "203.0.113.7", secret: "   " })).toEqual(
			{},
		);
	});

	test("no client ip when the runtime could not resolve one", () => {
		expect(vouchedClientHeaders({ secret: "s".repeat(32) })).toEqual({});
	});
});
