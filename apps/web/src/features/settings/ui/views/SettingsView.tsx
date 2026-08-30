import type { ResolvedQuizSettings } from "@recall/contracts";
import { SettingsEditor } from "@/features/settings/ui/components/SettingsEditor";
import { PageHeading } from "@/shared/ui/components/PageHeading";
import { SignInPrompt } from "@/shared/ui/components/SignInPrompt";

interface Props {
	readonly settings: ResolvedQuizSettings | null;
}

export function SettingsView({ settings }: Props) {
	if (settings === null) {
		return <SignInPrompt />;
	}

	return (
		<div className="space-y-6">
			<PageHeading
				title="Налаштування"
				caption="Діють для всіх наборів, поки набір не має власних"
			/>
			<SettingsEditor initial={settings} />
		</div>
	);
}
