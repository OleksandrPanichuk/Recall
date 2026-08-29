import type { BrowseView } from "@recall/contracts";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeading } from "@/components/PageHeading";
import { PageView } from "@/components/PageView";
import { SignInPrompt } from "@/components/SignInPrompt";
import { loadLibrary, saveSummary } from "@/lib/practice";

export const Route = createFileRoute("/folders/$folderId")({
	loader: async ({ context, params }) =>
		context.viewer === null ? null : loadLibrary({ data: params.folderId }),
	component: Folder,
});

function Folder() {
	const loaded = Route.useLoaderData();
	const { folderId } = Route.useParams();
	const [written, setWritten] = useState<BrowseView | null>(null);
	const [saving, setSaving] = useState(false);

	if (loaded === null) {
		return <SignInPrompt />;
	}

	const view = written?.folderId === folderId ? written : loaded;
	const name = view.name ?? "Сторінка";
	const save = async (summary: string) => {
		setSaving(true);

		try {
			setWritten(await saveSummary({ data: { folderId, summary } }));
		} finally {
			setSaving(false);
		}
	};

	return (
		<>
			<PageHeading
				title={view.icon === undefined ? name : `${view.icon} ${name}`}
				caption={
					view.breadcrumb.map((crumb) => crumb.name).join(" / ") || "Бібліотека"
				}
			/>
			<PageView view={view} saving={saving} onSave={save} />
		</>
	);
}
