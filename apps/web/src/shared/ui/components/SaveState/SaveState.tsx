import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import type { SaveState as State } from "@/shared/lib/save-state.types";
import { SAVE_STATE_LABEL } from "./SaveState.constants";

interface Props {
	readonly state: State;
}

export function SaveState({ state }: Props) {
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
			{SAVE_STATE_LABEL[state]}
		</span>
	);
}
