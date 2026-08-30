import type { Letter } from "@/application/ports/mailer";
import { RESET_TOKEN_TTL_SECONDS } from "./build-auth.constants";

export const resetPasswordLetter = (to: string, url: string): Letter => ({
	to,
	subject: "Відновлення пароля в Recall",
	text: [
		"Хтось попросив новий пароль для цього акаунта в Recall.",
		"",
		`Задати новий пароль: ${url}`,
		"",
		`Посилання діє ${RESET_TOKEN_TTL_SECONDS / 60} хвилин і спрацює один раз.`,
		"Якщо це були не ви — просто зігноруйте цей лист, пароль лишиться той самий.",
	].join("\n"),
});
