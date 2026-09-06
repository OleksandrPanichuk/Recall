export const LOGIN_ERRORS: Readonly<Record<string, string>> = {
	invalid_token:
		"That link was already used or has expired. Send the bot /login again.",
	unknown_user:
		"This Telegram account has no library yet. Start with /start in the bot.",
	session_failed: "Could not create a session. Try the link again.",
};

export function loginErrorFor(code: unknown): string | undefined {
	return typeof code === "string" ? LOGIN_ERRORS[code] : undefined;
}
