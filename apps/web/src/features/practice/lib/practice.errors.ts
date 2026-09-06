import { ApiErrorName, isApiError } from "@recall/contracts";

const messages: Readonly<Record<string, string>> = {
	[ApiErrorName.NoActiveAttempt]:
		"That attempt is gone. Go back to the quiz and start again.",
	[ApiErrorName.AttemptNotActive]:
		"The attempt is paused. Press Resume to answer.",
	[ApiErrorName.QuestionNotInAttempt]:
		"That question is already behind you. Reload the page.",
};

export const messageFor = (error: unknown): string => {
	if (isApiError(error)) {
		return (
			messages[error.errorName] ?? "That answer did not register. Try again."
		);
	}

	return "Could not reach the server. Try again.";
};
