import { createAppClient, type PracticeUseCases } from "@recall/contracts";
import { getRequestHeader } from "@tanstack/react-start/server";

const DEFAULT_API_URL = "http://127.0.0.1:8767";

export const apiUrl = (): string =>
	process.env.RECALL_API_URL ?? DEFAULT_API_URL;

export function api(): PracticeUseCases {
	return createAppClient({
		baseUrl: apiUrl(),
		cookie: getRequestHeader("cookie"),
	});
}
