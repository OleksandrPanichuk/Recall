export const SENT_NOTICE =
	"If that account exists, we have emailed a link. It is good for 30 minutes.";

const MESSAGES: Readonly<Record<string, string>> = {
	INVALID_EMAIL_OR_PASSWORD: "Wrong email or password.",
	USER_ALREADY_EXISTS: "An account with that email already exists.",
	PASSWORD_TOO_SHORT: "That password is too short.",
	INVALID_TOKEN: "That link has expired or was already used.",
	INVALID_PASSWORD: "That current password is wrong.",
	RESET_PASSWORD_DISABLED:
		"Password recovery is not configured on this server.",
};

export const failureText = (message: string | undefined): string => {
	if (message === undefined) {
		return "That did not work. Try again.";
	}

	if (message.toLowerCase().includes("too many requests")) {
		return "Too many attempts. Wait a moment.";
	}

	return MESSAGES[message] ?? message;
};
