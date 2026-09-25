import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
	HttpException,
	HttpStatus,
} from "@nestjs/common";
import { createLogger, type Logger } from "@recall/kit";
import type { Request, Response } from "express";
import { ModuleError } from "@/core/errors";
import { detailsOf, statusOf } from "./legacy-error-map";

interface Refusal {
	readonly status: number;
	readonly name: string;
	readonly message: string;
	readonly details?: Readonly<Record<string, string>>;
}

@Catch()
export class ModuleErrorFilter implements ExceptionFilter {
	constructor(private readonly logger: Logger = createLogger()) {}

	static refusalFor(exception: unknown): Refusal | undefined {
		if (exception instanceof ModuleError) {
			return {
				status: exception.status,
				name: exception.name,
				message: exception.message,
				details: exception.details(),
			};
		}

		if (!(exception instanceof Error)) {
			return undefined;
		}

		const status = statusOf(exception);

		return status === undefined
			? undefined
			: {
					status,
					name: exception.name,
					message: exception.message,
					details: detailsOf(exception),
				};
	}

	catch(exception: unknown, host: ArgumentsHost): void {
		const response = host.switchToHttp().getResponse<Response>();

		if (exception instanceof HttpException) {
			this.reportServerFailure(exception.getStatus(), exception, host);
			response.status(exception.getStatus()).json(exception.getResponse());

			return;
		}

		const refusal = ModuleErrorFilter.refusalFor(exception);

		if (refusal !== undefined) {
			this.reportServerFailure(refusal.status, exception, host);
			response.status(refusal.status).json({
				statusCode: refusal.status,
				error: refusal.name,
				message: refusal.message,
				...(refusal.details === undefined ? {} : { details: refusal.details }),
			});

			return;
		}

		this.reportServerFailure(HttpStatus.INTERNAL_SERVER_ERROR, exception, host);
		response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
			statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
			message: "Something went wrong",
		});
	}

	private reportServerFailure(
		status: number,
		exception: unknown,
		host: ArgumentsHost,
	): void {
		if (status < HttpStatus.INTERNAL_SERVER_ERROR) {
			return;
		}

		const request = host.switchToHttp().getRequest<Request>();

		this.logger.error("request failed on the server", {
			status,
			method: request?.method,
			route: request?.route?.path,
			error: exception,
		});
	}
}
