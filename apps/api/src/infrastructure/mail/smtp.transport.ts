import { createTransport, type Transporter } from "nodemailer";

export type SmtpTransport = Transporter;

export const createSmtpTransport = (url: string): SmtpTransport =>
	createTransport(url);
