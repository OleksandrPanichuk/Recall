import { createServerFn } from "@tanstack/react-start";
import { viewerOf } from "./session";

export const loadSession = createServerFn().handler(async () => ({
	viewer: (await viewerOf()) ?? null,
}));
