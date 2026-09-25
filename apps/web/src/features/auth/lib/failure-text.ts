import { AUTH_FAILURE_MESSAGES } from "@/features/auth/constants/auth-messages";

export const failureText = (message: string | undefined): string => {
	if (message === undefined) {
		return "That did not work. Try again.";
	}

	if (message.toLowerCase().includes("too many requests")) {
		return "Too many attempts. Wait a moment.";
	}

	return AUTH_FAILURE_MESSAGES[message] ?? message;
};
