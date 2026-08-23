import {
	type ArgumentsHost,
	Catch,
	type ExceptionFilter,
	HttpException,
	HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";
import { statusOf } from "./error-map";

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
	catch(exception: unknown, host: ArgumentsHost): void {
		const response = host.switchToHttp().getResponse<Response>();

		if (exception instanceof HttpException) {
			response.status(exception.getStatus()).json(exception.getResponse());

			return;
		}

		if (exception instanceof Error) {
			const status = statusOf(exception);

			if (status !== undefined) {
				response.status(status).json({
					statusCode: status,
					error: exception.name,
					message: exception.message,
				});

				return;
			}
		}

		response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
			statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
			message: "Something went wrong",
		});
	}
}
