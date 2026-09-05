import { createServerFn } from "@tanstack/react-start";
import { api } from "@/shared/lib/api";

export const loadApiTokens = createServerFn().handler(async () => ({
	tokens: await api().listApiTokens.execute({}),
}));

export const issueApiToken = createServerFn({ method: "POST" })
	.inputValidator(
		(value: unknown) => value as { name: string; expiresInDays?: number },
	)
	.handler(async ({ data }) => api().issueApiToken.execute(data));

export const revokeApiToken = createServerFn({ method: "POST" })
	.inputValidator((value: unknown) => value as { tokenId: string })
	.handler(async ({ data }) => api().revokeApiToken.execute(data));
