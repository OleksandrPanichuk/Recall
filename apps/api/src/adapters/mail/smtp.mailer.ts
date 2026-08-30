import { createTransport } from "nodemailer";
import type { Letter, Mailer } from "@/application/ports/mailer";

export interface SmtpOptions {
	readonly url: string;
	readonly from: string;
}

export function createSmtpMailer(options: SmtpOptions): Mailer {
	const transport = createTransport(options.url);

	return {
		async send(letter: Letter): Promise<void> {
			await transport.sendMail({
				from: options.from,
				to: letter.to,
				subject: letter.subject,
				text: letter.text,
			});
		},
	};
}
