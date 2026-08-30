import { createLogger } from "@recall/kit";
import { createLoggingMailer } from "@/adapters/mail/logging.mailer";
import { createSmtpMailer } from "@/adapters/mail/smtp.mailer";
import type { Mailer } from "@/application/ports/mailer";
import type { ApiEnvironment } from "../shared/config/api-env";

export function mailerFor(environment: ApiEnvironment): Mailer {
	if (environment.smtpUrl === undefined) {
		return createLoggingMailer(createLogger());
	}

	return createSmtpMailer({
		url: environment.smtpUrl,
		from: environment.mailFrom,
	});
}
