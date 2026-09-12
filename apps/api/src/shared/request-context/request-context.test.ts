import { describe, expect, test } from "bun:test";
import { toOwnerId } from "@/core/owner";
import type { Principal } from "@/core/principal";
import { AlsOwnerContext } from "./als-owner-context";
import {
	currentPrincipal,
	hasRequestContext,
	MissingRequestContextError,
	requireOwner,
	runAs,
	runInRequestContext,
	setPrincipal,
	UnauthenticatedError,
} from "./request-context";
import { requestContextMiddleware } from "./request-context.middleware";

const ada = toOwnerId("ada");
const grace = toOwnerId("grace");

const sessionOf = (owner: ReturnType<typeof toOwnerId>): Principal => ({
	kind: "session",
	owner,
});

describe("the request context", () => {
	test("is absent until the middleware opens one", () => {
		expect(hasRequestContext()).toBe(false);
		expect(currentPrincipal()).toBeUndefined();
	});

	test("opens empty, so a guard has somewhere to write", () => {
		runInRequestContext(() => {
			expect(hasRequestContext()).toBe(true);
			expect(currentPrincipal()).toBeUndefined();
		});
	});

	test("a guard writes the principal the rest of the request reads", () => {
		runInRequestContext(() => {
			setPrincipal(sessionOf(ada));

			expect(currentPrincipal()).toEqual(sessionOf(ada));
			expect(requireOwner()).toBe(ada);
		});
	});

	test("writing a principal with no context open is a mistake, not a silent no-op", () => {
		expect(() => setPrincipal(sessionOf(ada))).toThrow(
			MissingRequestContextError,
		);
	});

	test("an owner-scoped repository fails closed rather than seeing everything", () => {
		const owners = new AlsOwnerContext();

		expect(() => owners.current()).toThrow(UnauthenticatedError);
		runInRequestContext(() => {
			expect(() => owners.current()).toThrow(UnauthenticatedError);
		});
	});

	test("runAs binds a principal for work that starts outside a request", () => {
		const owners = new AlsOwnerContext();

		expect(runAs(sessionOf(grace), () => owners.current())).toBe(grace);
	});

	test("the principal does not escape the operation it was set in", () => {
		runInRequestContext(() => {
			setPrincipal(sessionOf(ada));
		});

		expect(currentPrincipal()).toBeUndefined();
	});

	test("two requests in flight never see each other's owner", async () => {
		const owners = new AlsOwnerContext();
		const seen: string[] = [];

		const request = (principal: Principal, delay: number) =>
			runInRequestContext(async () => {
				setPrincipal(principal);
				await new Promise((resolve) => setTimeout(resolve, delay));
				seen.push(owners.current());
			});

		await Promise.all([
			request(sessionOf(ada), 5),
			request(sessionOf(grace), 1),
		]);

		expect(seen).toEqual([grace, ada]);
	});

	test("a nested runAs shadows the outer principal and restores it", () => {
		const owners = new AlsOwnerContext();

		runAs(sessionOf(ada), () => {
			expect(runAs(sessionOf(grace), () => owners.current())).toBe(grace);
			expect(owners.current()).toBe(ada);
		});
	});
});

describe("the middleware", () => {
	test("opens a context around the rest of the request", () => {
		let inside: boolean | undefined;

		requestContextMiddleware({} as never, {} as never, () => {
			inside = hasRequestContext();
		});

		expect(inside).toBe(true);
		expect(hasRequestContext()).toBe(false);
	});

	test("opens a fresh context per request, so no principal leaks between them", () => {
		const seen: (Principal | undefined)[] = [];

		requestContextMiddleware({} as never, {} as never, () => {
			setPrincipal(sessionOf(ada));
			seen.push(currentPrincipal());
		});
		requestContextMiddleware({} as never, {} as never, () => {
			seen.push(currentPrincipal());
		});

		expect(seen).toEqual([sessionOf(ada), undefined]);
	});
});
