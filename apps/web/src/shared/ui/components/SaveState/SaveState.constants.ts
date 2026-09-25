import type { SaveState } from "@/shared/lib/save-state.types";

export const SAVE_STATE_LABEL: Record<Exclude<SaveState, "idle">, string> = {
	pending: "Unsaved changes",
	saving: "Saving…",
	saved: "Saved",
	failed: "Could not save",
};
