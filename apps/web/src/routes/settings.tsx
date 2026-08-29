import { createFileRoute } from "@tanstack/react-router";
import { PageHeading } from "@/components/PageHeading";
import { SettingsEditor } from "@/components/SettingsEditor";
import { SignInPrompt } from "@/components/SignInPrompt";
import { loadSettings } from "@/lib/practice";

export const Route = createFileRoute("/settings")({
	loader: async ({ context }) =>
		context.viewer === null ? null : loadSettings({ data: undefined }),
	component: Settings,
});

function Settings() {
	const loaded = Route.useLoaderData();

	if (loaded === null) {
		return <SignInPrompt />;
	}

	return (
		<div className="space-y-6">
			<PageHeading
				title="Налаштування"
				caption="Діють для всіх наборів, поки набір не має власних"
			/>
			<SettingsEditor initial={loaded} />
		</div>
	);
}
