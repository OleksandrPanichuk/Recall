import type { Letter } from "@/application/ports/mailer";
import { RESET_TOKEN_TTL_SECONDS } from "./build-auth.constants";

export const resetPasswordLetter = (to: string, url: string): Letter => ({
	to,
	subject: "Reset your Recall password",
	text: [
		"Someone asked for a new password for this Recall account.",
		"",
		`Set a new password: ${url}`,
		"",
		`The link is good for ${RESET_TOKEN_TTL_SECONDS / 60} minutes and works once.`,
		"If this was not you, ignore this email — your password stays as it is.",
	].join("\n"),
});
