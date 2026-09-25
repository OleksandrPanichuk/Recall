import type { QueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { viewerOf } from "./session";

const SESSION_QUERY_KEY = ["session"] as const;
const PRELOAD_SESSION_STALE_MS = 30_000;

export const loadSession = createServerFn().handler(async () => ({
	viewer: (await viewerOf()) ?? null,
}));

export const sessionFor = (queryClient: QueryClient, preload: boolean) =>
	queryClient.fetchQuery({
		queryKey: SESSION_QUERY_KEY,
		queryFn: () => loadSession(),
		staleTime: preload ? PRELOAD_SESSION_STALE_MS : 0,
		retry: false,
	});
