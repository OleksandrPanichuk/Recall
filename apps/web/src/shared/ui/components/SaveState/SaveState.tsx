import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import type { SaveState as State } from "@/shared/lib/save-state.types";

const label: Record<Exclude<State, "idle">, string> = {
	pending: "Зміни не збережені",
	saving: "Збереження…",
	saved: "Збережено",
	failed: "Не вдалося зберегти",
};

export function SaveState({ state }: { readonly state: State }) {
	if (state === "idle") {
		return null;
	}

	return (
		<span
			className={`flex items-center gap-1.5 text-xs ${
				state === "failed" ? "text-destructive" : "text-muted-foreground"
			}`}
		>
			{state === "saving" ? (
				<LoaderCircle className="size-3 animate-spin" />
			) : null}
			{state === "saved" ? <Check className="size-3" /> : null}
			{state === "failed" ? <CircleAlert className="size-3" /> : null}
			{label[state]}
		</span>
	);
}
