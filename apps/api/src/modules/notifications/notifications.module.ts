import { Module } from "@nestjs/common";
import { createLogger, type Logger } from "@recall/kit";
import { LogMailer } from "@/adapters/mail/log.mailer";
import { SmtpMailer } from "@/adapters/mail/smtp.mailer";
import { type ApiEnvironment, loadApiEnvironment } from "@/configs/env.config";
import { Mailer } from "./ports";

@Module({
	providers: [
		{
			provide: Mailer,
			useFactory: (): Mailer =>
				NotificationsModule.mailerFor(loadApiEnvironment()),
		},
	],
	exports: [Mailer],
})
export class NotificationsModule {
	static mailerFor(
		environment: ApiEnvironment,
		logger: Logger = createLogger(),
	): Mailer {
		if (environment.smtpUrl === undefined) {
			return new LogMailer(logger);
		}

		return new SmtpMailer({
			url: environment.smtpUrl,
			from: environment.mailFrom,
		});
	}
}
