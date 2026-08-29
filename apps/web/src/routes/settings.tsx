import { createFileRoute } from "@tanstack/react-router";
import { loadSettings } from "@/features/settings/lib/settings.api";
import { SettingsView } from "@/features/settings/ui/views/SettingsView";

export const Route = createFileRoute("/settings")({
	loader: async ({ context }) =>
		context.viewer === null ? null : loadSettings({ data: undefined }),
	component: Settings,
});

function Settings() {
	return <SettingsView settings={Route.useLoaderData()} />;
}
