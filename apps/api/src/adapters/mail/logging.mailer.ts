import type { Logger } from "@recall/kit";
import type { Letter, Mailer } from "@/application/ports/mailer";

export function createLoggingMailer(logger: Logger): Mailer {
	return {
		async send(letter: Letter): Promise<void> {
			logger.warn("no smtp is configured, so this mail was only logged", {
				to: letter.to,
				subject: letter.subject,
				text: letter.text,
			});
		},
	};
}
