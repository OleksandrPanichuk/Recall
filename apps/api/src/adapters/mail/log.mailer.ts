import type { Logger } from "@recall/kit";
import {
	type Letter,
	Mailer,
} from "@/modules/notifications/notifications.port";

export class LogMailer extends Mailer {
	constructor(private readonly logger: Logger) {
		super();
	}

	async send(letter: Letter): Promise<void> {
		this.logger.warn("no smtp is configured, so this mail was only logged", {
			to: letter.to,
			subject: letter.subject,
			text: letter.text,
		});
	}
}
