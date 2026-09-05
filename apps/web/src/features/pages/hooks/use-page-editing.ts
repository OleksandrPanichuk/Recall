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
	const [restored, setRestored] = useState(0);
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
		restored,
		restore: async (summary: string) => {
			await refresh(await saveSummary({ data: { folderId, summary } }));
			setRestored((count) => count + 1);
		},
		invalidate: () => router.invalidate(),
		rename: async (name: string) =>
			refresh(await renamePage({ data: { folderId, name } })),
		pickIcon: async (icon: string | undefined) =>
			refresh(await setPageIcon({ data: { folderId, icon } })),
	};
}
