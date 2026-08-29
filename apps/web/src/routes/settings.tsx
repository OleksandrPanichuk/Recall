import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeading } from "@/components/PageHeading";
import { SettingsForm } from "@/components/SettingsForm";
import { SignInPrompt } from "@/components/SignInPrompt";
import { loadSettings, saveSettings } from "@/lib/practice";

export const Route = createFileRoute("/settings")({
	loader: async ({ context }) =>
		context.viewer === null ? null : loadSettings({ data: undefined }),
	component: Settings,
});

function Settings() {
	const loaded = Route.useLoaderData();
	const [resolved, setResolved] = useState(loaded);
	const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">(
		"idle",
	);

	if (loaded === null || resolved === null) {
		return <SignInPrompt />;
	}

	const change = async (patch: Record<string, unknown>) => {
		setState("saving");

		try {
			setResolved(await saveSettings({ data: patch }));
			setState("saved");
		} catch {
			setState("failed");
		}
	};

	return (
		<div className="space-y-6">
			<PageHeading
				title="Налаштування"
				caption="Діють для всіх наборів, поки набір не має власних"
			/>
			<SettingsForm resolved={resolved} state={state} onChange={change} />
		</div>
	);
}
