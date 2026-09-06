export const expiryLabel = (
	expiresAt: string | undefined,
	now: Date,
): string => {
	if (expiresAt === undefined) {
		return "no expiry";
	}

	const at = new Date(expiresAt);

	if (Number.isNaN(at.getTime())) {
		return "no expiry";
	}

	if (at.getTime() <= now.getTime()) {
		return "expired";
	}

	return `until ${at.toLocaleDateString("en-GB")}`;
};

export const lastUsedLabel = (lastUsedAt: string | undefined): string =>
	lastUsedAt === undefined
		? "never used"
		: `last used ${new Date(lastUsedAt).toLocaleDateString("en-GB")}`;
