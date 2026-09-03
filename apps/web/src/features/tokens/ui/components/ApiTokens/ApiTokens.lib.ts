export const expiryLabel = (
	expiresAt: string | undefined,
	now: Date,
): string => {
	if (expiresAt === undefined) {
		return "без терміну";
	}

	const at = new Date(expiresAt);

	if (Number.isNaN(at.getTime())) {
		return "без терміну";
	}

	if (at.getTime() <= now.getTime()) {
		return "прострочений";
	}

	return `до ${at.toLocaleDateString("uk-UA")}`;
};

export const lastUsedLabel = (lastUsedAt: string | undefined): string =>
	lastUsedAt === undefined
		? "ще не використовувався"
		: `востаннє ${new Date(lastUsedAt).toLocaleDateString("uk-UA")}`;
