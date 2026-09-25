import { matchesSecret } from "@recall/kit";
import type { NextFunction, Request, Response } from "express";
import {
	CLIENT_IP_HEADER,
	CLIENT_IP_SECRET_HEADER,
	FORWARDED_FOR_HEADER,
} from "./auth.constants";

const single = (value: string | string[] | undefined): string | undefined =>
	typeof value === "string" ? value : undefined;

const vouchedFor = (request: Request, secret: string | undefined): boolean => {
	const offered = single(request.headers[CLIENT_IP_SECRET_HEADER]);

	return (
		secret !== undefined &&
		offered !== undefined &&
		matchesSecret(offered, secret)
	);
};

export function clientAddressMiddleware(secret: string | undefined) {
	return (request: Request, _response: Response, next: NextFunction): void => {
		const forwarded = single(request.headers[CLIENT_IP_HEADER]);
		const address =
			vouchedFor(request, secret) && forwarded !== undefined
				? forwarded
				: request.socket.remoteAddress;

		delete request.headers[CLIENT_IP_SECRET_HEADER];
		delete request.headers[FORWARDED_FOR_HEADER];
		delete request.headers[CLIENT_IP_HEADER];

		if (address !== undefined) {
			request.headers[CLIENT_IP_HEADER] = address;
		}

		next();
	};
}
