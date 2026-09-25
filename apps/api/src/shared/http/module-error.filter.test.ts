import { describe, expect, test } from "bun:test";
import {
	type ArgumentsHost,
	InternalServerErrorException,
	NotFoundException,
} from "@nestjs/common";
import { type LogFields, type Logger, silentLogger } from "@recall/kit";
import { ModuleError } from "@/core/errors";
import { ModuleErrorFilter } from "./module-error.filter";

class QuizSetArchivedError extends ModuleError {
	readonly status = 409;
	readonly code = "QUIZ_SET_ARCHIVED";

	constructor(private readonly quizSetId: string) {
		super("an archived quiz set cannot be published");
	}

	override details(): Readonly<Record<string, string>> {
		return { quizSetId: this.quizSetId };
	}
}

class ServiceDownError extends ModuleError {
	readonly status = 503;
	readonly code = "SERVICE_DOWN";

	constructor() {
		super("the service is down");
	}
}

class LegacyQuizSetNotFoundError extends Error {
	readonly quizSetId = "q7";
	readonly secret = "must not travel";

	constructor() {
		super("Quiz set q7 was not found");
		this.name = "QuizSetNotFoundError";
	}
}

describe("ModuleErrorFilter.refusalFor", () => {
	test("reads a module error off the class", () => {
		expect(
			ModuleErrorFilter.refusalFor(new QuizSetArchivedError("q1")),
		).toEqual({
			status: 409,
			name: "QuizSetArchivedError",
			message: "an archived quiz set cannot be published",
			details: { quizSetId: "q1" },
		});
	});

	test("still reads a v1 domain error out of the name table", () => {
		expect(
			ModuleErrorFilter.refusalFor(new LegacyQuizSetNotFoundError()),
		).toEqual({
			status: 404,
			name: "QuizSetNotFoundError",
			message: "Quiz set q7 was not found",
			details: { quizSetId: "q7" },
		});
	});

	test("carries only whitelisted details off a v1 error", () => {
		expect(
			ModuleErrorFilter.refusalFor(new LegacyQuizSetNotFoundError())?.details,
		).not.toHaveProperty("secret");
	});

	test("sends the class name, because the bot maps refusals by name", () => {
		expect(
			ModuleErrorFilter.refusalFor(new QuizSetArchivedError("q1"))?.name,
		).toBe("QuizSetArchivedError");
	});

	test("refuses to guess at an error it does not recognise", () => {
		expect(
			ModuleErrorFilter.refusalFor(new Error("something broke")),
		).toBeUndefined();
		expect(ModuleErrorFilter.refusalFor("a thrown string")).toBeUndefined();
	});

	test("a module error needs no entry in the name table", () => {
		expect(
			ModuleErrorFilter.refusalFor(new QuizSetArchivedError("q1"))?.status,
		).toBe(409);
	});
});

const hostFor = (response: object, request: object = {}): ArgumentsHost =>
	({
		switchToHttp: () => ({
			getResponse: () => response,
			getRequest: () => request,
		}),
	}) as unknown as ArgumentsHost;

const recordingResponse = () => {
	const sent: { status?: number; body?: unknown } = {};
	const response = {
		status(code: number) {
			sent.status = code;

			return response;
		},
		json(body: unknown) {
			sent.body = body;

			return response;
		},
	};

	return { response, sent };
};

const recordingLogger = () => {
	const errors: { message: string; fields?: LogFields }[] = [];
	const logger: Logger = {
		...silentLogger,
		error: (message, fields) => {
			errors.push({ message, fields });
		},
	};

	return { logger, errors };
};

describe("ModuleErrorFilter.catch", () => {
	test("logs an exception it does not recognise before answering 500", () => {
		const { logger, errors } = recordingLogger();
		const { response, sent } = recordingResponse();
		const failure = new Error("pool exhausted", {
			cause: new Error("connect ECONNREFUSED"),
		});

		new ModuleErrorFilter(logger).catch(
			failure,
			hostFor(response, { method: "POST", route: { path: "/bot/answer" } }),
		);

		expect(sent.status).toBe(500);
		expect(sent.body).toEqual({
			statusCode: 500,
			message: "Something went wrong",
		});
		expect(errors).toHaveLength(1);
		expect(errors[0]?.fields).toMatchObject({
			method: "POST",
			route: "/bot/answer",
			error: failure,
		});
	});

	test("logs a thrown value that is not an error", () => {
		const { logger, errors } = recordingLogger();
		const { response, sent } = recordingResponse();

		new ModuleErrorFilter(logger).catch("a thrown string", hostFor(response));

		expect(sent.status).toBe(500);
		expect(errors[0]?.fields).toMatchObject({ error: "a thrown string" });
	});

	test("logs a refusal that is the server's own failure", () => {
		const { logger, errors } = recordingLogger();
		const { response, sent } = recordingResponse();

		new ModuleErrorFilter(logger).catch(
			new ServiceDownError(),
			hostFor(response),
		);

		expect(sent.status).toBe(503);
		expect(sent.body).toMatchObject({ error: "ServiceDownError" });
		expect(errors).toHaveLength(1);
	});

	test("logs a 5xx http exception, not a 4xx one", () => {
		const { logger, errors } = recordingLogger();

		new ModuleErrorFilter(logger).catch(
			new NotFoundException(),
			hostFor(recordingResponse().response),
		);
		new ModuleErrorFilter(logger).catch(
			new InternalServerErrorException(),
			hostFor(recordingResponse().response),
		);

		expect(errors).toHaveLength(1);
	});

	test("does not log a refusal it answers on purpose", () => {
		const { logger, errors } = recordingLogger();
		const { response, sent } = recordingResponse();

		new ModuleErrorFilter(logger).catch(
			new QuizSetArchivedError("q1"),
			hostFor(response),
		);

		expect(sent.status).toBe(409);
		expect(errors).toEqual([]);
	});
});
