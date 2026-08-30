import type { ResolvedQuizSettings } from "@recall/contracts";
import { ChangePasswordForm } from "@/features/auth/ui/components/ChangePasswordForm";
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

			<section className="space-y-3 pt-4">
				<h2 className="text-sm font-medium text-muted-foreground">Акаунт</h2>
				<ChangePasswordForm />
			</section>
		</div>
	);
}
