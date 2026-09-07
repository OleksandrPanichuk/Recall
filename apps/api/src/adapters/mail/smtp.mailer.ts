import {
	createSmtpTransport,
	type SmtpTransport,
} from "@/infrastructure/mail/smtp.transport";
import {
	type Letter,
	Mailer,
} from "@/modules/notifications/notifications.port";

export interface SmtpOptions {
	readonly url: string;
	readonly from: string;
}

export class SmtpMailer extends Mailer {
	private readonly transport: SmtpTransport;

	constructor(private readonly options: SmtpOptions) {
		super();
		this.transport = createSmtpTransport(options.url);
	}

	async send(letter: Letter): Promise<void> {
		await this.transport.sendMail({
			from: this.options.from,
			to: letter.to,
			subject: letter.subject,
			text: letter.text,
		});
	}
}
