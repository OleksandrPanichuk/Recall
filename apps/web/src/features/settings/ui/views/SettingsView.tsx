import type { ApiToken, ResolvedQuizSettings } from "@recall/contracts";
import { ChangePasswordForm } from "@/features/auth/ui/components/ChangePasswordForm";
import { SettingsEditor } from "@/features/settings/ui/components/SettingsEditor";
import { ApiTokens } from "@/features/tokens/ui/components/ApiTokens";
import { PageHeading } from "@/shared/ui/components/PageHeading";
import { SignInPrompt } from "@/shared/ui/components/SignInPrompt";

interface Props {
	readonly settings: ResolvedQuizSettings | null;
	readonly tokens: readonly ApiToken[];
}

export function SettingsView({ settings, tokens }: Props) {
	if (settings === null) {
		return <SignInPrompt />;
	}

	return (
		<div className="space-y-6">
			<PageHeading
				title="Settings"
				caption="Apply to every quiz that has no settings of its own"
			/>
			<SettingsEditor initial={settings} />

			<section className="space-y-3 pt-4">
				<h2 className="text-sm font-medium text-muted-foreground">Account</h2>
				<ChangePasswordForm />
			</section>

			<section className="space-y-3 pt-4">
				<h2 className="text-sm font-medium text-muted-foreground">
					MCP tokens
				</h2>
				<ApiTokens tokens={tokens} />
			</section>
		</div>
	);
}
