import { describe, expect, test } from "bun:test";
import type { NextFunction, Request, Response } from "express";
import { clientAddressMiddleware } from "./auth.client-address";
import {
	CLIENT_IP_HEADER,
	CLIENT_IP_SECRET_HEADER,
	FORWARDED_FOR_HEADER,
} from "./auth.constants";

const SECRET = "s".repeat(40);
const SOCKET = "10.0.0.9";

const passedThrough = (
	secret: string | undefined,
	headers: Record<string, string>,
): Record<string, unknown> => {
	const request = {
		headers: { ...headers },
		socket: { remoteAddress: SOCKET },
	} as unknown as Request;
	let called = false;

	clientAddressMiddleware(secret)(
		request,
		{} as Response,
		(() => {
			called = true;
		}) as NextFunction,
	);

	expect(called).toBe(true);

	return request.headers as Record<string, unknown>;
};

describe("which client address Better Auth is shown", () => {
	test("the forwarded one, when the right secret vouches for it", () => {
		const headers = passedThrough(SECRET, {
			[CLIENT_IP_HEADER]: "203.0.113.7",
			[CLIENT_IP_SECRET_HEADER]: SECRET,
		});

		expect(headers[CLIENT_IP_HEADER]).toBe("203.0.113.7");
		expect(headers[CLIENT_IP_SECRET_HEADER]).toBeUndefined();
	});

	test("the socket's, when the secret is wrong", () => {
		const headers = passedThrough(SECRET, {
			[CLIENT_IP_HEADER]: "203.0.113.7",
			[CLIENT_IP_SECRET_HEADER]: "w".repeat(40),
		});

		expect(headers[CLIENT_IP_HEADER]).toBe(SOCKET);
		expect(headers[CLIENT_IP_SECRET_HEADER]).toBeUndefined();
	});

	test("the socket's, when the api was given no secret at all", () => {
		const headers = passedThrough(undefined, {
			[CLIENT_IP_HEADER]: "203.0.113.7",
			[CLIENT_IP_SECRET_HEADER]: SECRET,
		});

		expect(headers[CLIENT_IP_HEADER]).toBe(SOCKET);
	});

	test("never x-forwarded-for, which any caller can write", () => {
		const headers = passedThrough(SECRET, {
			[FORWARDED_FOR_HEADER]: "198.51.100.1",
		});

		expect(headers[FORWARDED_FOR_HEADER]).toBeUndefined();
		expect(headers[CLIENT_IP_HEADER]).toBe(SOCKET);
	});
});
