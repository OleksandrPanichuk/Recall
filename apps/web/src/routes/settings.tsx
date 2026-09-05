import { createFileRoute } from "@tanstack/react-router";
import { loadSettings } from "@/features/settings/lib/settings.api";
import { SettingsView } from "@/features/settings/ui/views/SettingsView";
import { loadApiTokens } from "@/features/tokens/lib/tokens.api";

export const Route = createFileRoute("/settings")({
	loader: async ({ context }) => {
		if (context.viewer === null) {
			return null;
		}

		const [settings, tokens] = await Promise.all([
			loadSettings({ data: undefined }),
			loadApiTokens(),
		]);

		return { settings, tokens: tokens.tokens };
	},
	head: () => ({ meta: [{ title: "Налаштування · Recall" }] }),
	component: Settings,
});

function Settings() {
	const loaded = Route.useLoaderData();

	return (
		<SettingsView
			settings={loaded?.settings ?? null}
			tokens={loaded?.tokens ?? []}
		/>
	);
}
