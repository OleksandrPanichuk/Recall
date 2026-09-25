import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type { ExecutionContext } from "@nestjs/common";
import type { OwnerId } from "@/core/owner";
import {
	type AuthService,
	BotTokenGuard,
	InstanceHasNoOwnerError,
} from "@/modules/auth";
import {
	currentPrincipal,
	runInRequestContext,
} from "@/shared/request-context";

const BOT_TOKEN = "b".repeat(40);

const contextFor = (): ExecutionContext =>
	({
		switchToHttp: () => ({
			getRequest: () => ({
				headers: { authorization: `Bearer ${BOT_TOKEN}` },
				body: {},
			}),
		}),
	}) as unknown as ExecutionContext;

const guardWith = (instanceOwner: () => Promise<OwnerId>): BotTokenGuard =>
	new BotTokenGuard({ instanceOwner } as unknown as AuthService);

const ENVIRONMENT: Readonly<Record<string, string>> = {
	BOT_API_TOKEN: BOT_TOKEN,
	DATABASE_URL: "postgres://recall:recall@127.0.0.1:1/unused",
};

const previous = new Map<string, string | undefined>();

beforeEach(() => {
	for (const [name, value] of Object.entries(ENVIRONMENT)) {
		previous.set(name, process.env[name]);
		process.env[name] = value;
	}
});

afterEach(() => {
	for (const [name, value] of previous) {
		if (value === undefined) {
			delete process.env[name];
		} else {
			process.env[name] = value;
		}
	}
});

describe("BotTokenGuard", () => {
	test("lets a call through with no owner while nobody has linked", async () => {
		const guard = guardWith(() =>
			Promise.reject(new InstanceHasNoOwnerError("nobody linked")),
		);

		await runInRequestContext(async () => {
			expect(await guard.canActivate(contextFor())).toBe(true);
			expect(currentPrincipal()).toBeUndefined();
		});
	});

	test("does not dress a failed owner lookup up as a signed-out caller", async () => {
		const outage = new Error("connect ECONNREFUSED 127.0.0.1:55432");
		const guard = guardWith(() => Promise.reject(outage));
		const failure = await runInRequestContext(() =>
			guard.canActivate(contextFor()).then(
				() => undefined,
				(error: unknown) => error,
			),
		);

		expect(failure).toBe(outage);
	});
});
