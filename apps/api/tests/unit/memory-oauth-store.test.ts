import { createMemoryOAuthStore } from "@tests/fixtures/memory-oauth.store";
import { describeOAuthStore } from "../contracts/oauth-store.contract";

let current = new Date("2026-08-01T10:00:00.000Z");

describeOAuthStore("in-memory", () => ({
	store: createMemoryOAuthStore(() => current),
	owner: "owner-1",
	at: () => current,
	travel: (milliseconds) => {
		current = new Date(current.getTime() + milliseconds);
	},
	reset: async () => {
		current = new Date("2026-08-01T10:00:00.000Z");
	},
}));
