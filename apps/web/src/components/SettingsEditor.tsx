import type { ResolvedQuizSettings } from "@recall/contracts";
import { useState } from "react";
import { SettingsForm } from "@/components/SettingsForm";
import type { SaveState } from "@/hooks/use-autosave";
import { saveSettings } from "@/lib/practice";

export interface SettingsEditorProps {
	readonly initial: ResolvedQuizSettings;
	readonly quizSetId?: string;
}

export function SettingsEditor({ initial, quizSetId }: SettingsEditorProps) {
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
