import type { ResolvedQuizSettings } from "@recall/contracts";
import { useState } from "react";
import { saveSettings } from "@/features/settings/lib/settings.api";
import { SettingsForm } from "@/features/settings/ui/components/SettingsForm";
import type { SaveState } from "@/shared/lib/save-state.types";

interface Props {
	readonly initial: ResolvedQuizSettings;
	readonly quizSetId?: string;
}

export function SettingsEditor({ initial, quizSetId }: Props) {
	const [resolved, setResolved] = useState(initial);
	const [state, setState] = useState<SaveState>("idle");

	const change = async (patch: Record<string, unknown>) => {
		setState("saving");

		try {
			setResolved(await saveSettings({ data: { ...patch, quizSetId } }));
			setState("saved");
		} catch {
			setState("failed");
		}
	};

	return (
		<SettingsForm
			resolved={resolved}
			state={state}
			scoped={quizSetId !== undefined}
			onChange={change}
		/>
	);
}
