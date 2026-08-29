import type { BrowseView } from "@recall/contracts";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useAutosave } from "@/features/pages/hooks/use-autosave";
import {
	renamePage,
	saveSummary,
	setPageIcon,
} from "@/features/pages/lib/pages.api";

export function usePageEditing(folderId: string, loaded: BrowseView | null) {
	const router = useRouter();
	const [written, setWritten] = useState<BrowseView | null>(null);
	const { state, schedule, flush } = useAutosave(async (summary) => {
		setWritten(await saveSummary({ data: { folderId, summary } }));
	});

	const refresh = async (next: BrowseView) => {
		setWritten(next);
		await router.invalidate();
	};

	return {
		view: written?.folderId === folderId ? written : loaded,
		state,
		schedule,
		flush,
		invalidate: () => router.invalidate(),
		rename: async (name: string) =>
			refresh(await renamePage({ data: { folderId, name } })),
		pickIcon: async (icon: string | undefined) =>
			refresh(await setPageIcon({ data: { folderId, icon } })),
	};
}
