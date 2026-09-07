import { describe, expect, test } from "bun:test";
import type { Logger } from "@recall/kit";
import type { ApiEnvironment } from "@/configs/env.config";
import { NotificationsModule } from "./notifications.module";
import type { Letter } from "./ports";

const environment = (smtpUrl?: string): ApiEnvironment =>
	({
		smtpUrl,
		mailFrom: "Recall <no-reply@recall.local>",
	}) as ApiEnvironment;

const recordingLogger = () => {
	const warnings: { message: string; fields?: unknown }[] = [];

	return {
		warnings,
		logger: {
			debug: () => undefined,
			info: () => undefined,
			warn: (message: string, fields?: unknown) => {
				warnings.push({ message, fields });
			},
			error: () => undefined,
		} as unknown as Logger,
	};
};

const letter: Letter = {
	to: "ada@example.com",
	subject: "Reset your Recall password",
	text: "Set a new password: https://recall.local/reset?token=abc",
};

describe("NotificationsModule.mailerFor", () => {
	test("logs the whole letter when no smtp is configured, so the link is reachable locally", async () => {
		const { logger, warnings } = recordingLogger();

		await NotificationsModule.mailerFor(environment(), logger).send(letter);

		expect(warnings).toHaveLength(1);
		expect(warnings[0]?.message).toContain("only logged");
		expect(warnings[0]?.fields).toEqual({
			to: letter.to,
			subject: letter.subject,
			text: letter.text,
		});
	});

	test("says so rather than pretending to have sent", () => {
		const { logger } = recordingLogger();

		expect(
			NotificationsModule.mailerFor(environment(), logger).constructor.name,
		).toBe("LogMailer");
	});

	test("sends over smtp once a url is configured", () => {
		const { logger, warnings } = recordingLogger();
		const mailer = NotificationsModule.mailerFor(
			environment("smtp://127.0.0.1:55025"),
			logger,
		);

		expect(mailer.constructor.name).toBe("SmtpMailer");
		expect(warnings).toBeEmpty();
	});
});
