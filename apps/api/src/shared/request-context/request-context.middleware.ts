import type { NextFunction, Request, Response } from "express";
import { runInRequestContext } from "./request-context";

export const requestContextMiddleware = (
	_request: Request,
	_response: Response,
	next: NextFunction,
): void => {
	runInRequestContext(next);
};
