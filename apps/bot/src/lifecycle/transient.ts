const TRANSIENT_CODES: ReadonlySet<string> = new Set([
	"ConnectionClosed",
	"ConnectionRefused",
	"EAI_AGAIN",
	"ECONNABORTED",
	"ECONNREFUSED",
	"ECONNRESET",
	"EHOSTUNREACH",
	"ENETDOWN",
	"ENETUNREACH",
	"ENOTFOUND",
	"EPIPE",
	"ETIMEDOUT",
	"UND_ERR_CONNECT_TIMEOUT",
	"UND_ERR_SOCKET",
]);

function codeOf(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}

	const code = (error as { code?: unknown }).code;

	return typeof code === "string" ? code : undefined;
}

export function isTransientNetworkError(error: unknown): boolean {
	if (typeof error !== "object" || error === null) {
		return false;
	}

	const code = codeOf(error);

	if (code !== undefined && TRANSIENT_CODES.has(code)) {
		return true;
	}

	if ((error as { name?: unknown }).name === "FetchError") {
		return true;
	}

	const cause = (error as { cause?: unknown }).cause;

	return cause === undefined ? false : isTransientNetworkError(cause);
}
