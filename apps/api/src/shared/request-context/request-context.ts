import { AsyncLocalStorage } from "node:async_hooks";
import type { OwnerId } from "@/core/owner";
import type { Principal } from "@/core/principal";

export interface RequestContext {
	principal?: Principal;
}

export class MissingRequestContextError extends Error {
	constructor() {
		super(
			"no request context is open; the middleware runs above every route, including the raw mounts",
		);
		this.name = "MissingRequestContextError";
	}
}

export class UnauthenticatedError extends Error {
	constructor() {
		super("this request carries no principal, so it has no owner");
		this.name = "UnauthenticatedError";
	}
}

const storage = new AsyncLocalStorage<RequestContext>();

export const runInRequestContext = <TResult>(
	operation: () => TResult,
): TResult => storage.run({}, operation);

export const runAs = <TResult>(
	principal: Principal,
	operation: () => TResult,
): TResult => storage.run({ principal }, operation);

export const currentPrincipal = (): Principal | undefined =>
	storage.getStore()?.principal;

export const hasRequestContext = (): boolean =>
	storage.getStore() !== undefined;

export function setPrincipal(principal: Principal): void {
	const context = storage.getStore();

	if (context === undefined) {
		throw new MissingRequestContextError();
	}

	context.principal = principal;
}

export function requirePrincipal(): Principal {
	const principal = currentPrincipal();

	if (principal === undefined) {
		throw new UnauthenticatedError();
	}

	return principal;
}

export const requireOwner = (): OwnerId => requirePrincipal().owner;
