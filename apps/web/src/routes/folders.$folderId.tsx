import type { BrowseView } from "@recall/contracts";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { EmojiPicker } from "@/components/EmojiPicker";
import { PageActions } from "@/components/PageActions";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { PageTitle } from "@/components/PageTitle";
import { PageView } from "@/components/PageView";
import { SaveState } from "@/components/SaveState";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useAutosave } from "@/hooks/use-autosave";
import {
	loadLibrary,
	renamePage,
	saveSummary,
	setPageIcon,
} from "@/lib/practice";

export const Route = createFileRoute("/folders/$folderId")({
	loader: async ({ context, params }) =>
		context.viewer === null ? null : loadLibrary({ data: params.folderId }),
	component: Page,
});

function Page() {
	const loaded = Route.useLoaderData();
	const { folderId } = Route.useParams();
	const router = useRouter();
	const [written, setWritten] = useState<BrowseView | null>(null);
	const { state, schedule, flush } = useAutosave(async (summary) => {
		setWritten(await saveSummary({ data: { folderId, summary } }));
	});

	if (loaded === null) {
		return <SignInPrompt />;
	}

	const view = written?.folderId === folderId ? written : loaded;

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<PageBreadcrumb crumbs={view.breadcrumb} />
				<div className="flex items-center gap-2">
					<SaveState state={state} />
					<PageActions
						view={view}
						onChanged={() => router.invalidate()}
						onFlush={flush}
					/>
				</div>
			</div>
			<div className="flex items-start gap-2">
				<EmojiPicker
					icon={view.icon}
					onPick={async (icon) => {
						setWritten(await setPageIcon({ data: { folderId, icon } }));
					}}
				/>
				<div className="min-w-0 flex-1 pt-1.5">
					<PageTitle
						name={view.name ?? ""}
						onRename={async (name) => {
							setWritten(await renamePage({ data: { folderId, name } }));
							await router.invalidate();
						}}
					/>
				</div>
			</div>
			<PageView view={view} onEdit={schedule} />
		</div>
	);
}
