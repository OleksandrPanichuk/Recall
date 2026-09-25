import type { BrowseView } from "@recall/contracts";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAutosave } from "@/features/pages/hooks/use-autosave";
import {
	attachQuiz,
	detachQuiz,
	renamePage,
	saveSummary,
	setPageIcon,
	sharePage,
	unsharePage,
} from "@/features/pages/lib/pages.api";

type WriteSummary = (input: {
	data: { folderId: string; summary: string };
}) => Promise<BrowseView>;

export function usePageEditing(
	folderId: string,
	loaded: BrowseView | null,
	writeSummary: WriteSummary = saveSummary,
) {
	const router = useRouter();
	const [written, setWritten] = useState<BrowseView | null>(null);
	const [restored, setRestored] = useState(0);
	const { state, schedule, flush, discard } = useAutosave(async (summary) => {
		setWritten(await writeSummary({ data: { folderId, summary } }));
	});

	const shown = useRef(folderId);

	useEffect(() => {
		if (shown.current !== folderId) {
			shown.current = folderId;
			void flush();
		}
	}, [folderId, flush]);

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
			await discard();
			await refresh(await writeSummary({ data: { folderId, summary } }));
			setRestored((count) => count + 1);
		},
		invalidate: () => router.invalidate(),
		share: async (rotate: boolean) =>
			refresh(await sharePage({ data: { folderId, rotate } })),
		unshare: async () => refresh(await unsharePage({ data: folderId })),
		attach: async (quizSetId: string) =>
			refresh(await attachQuiz({ data: { folderId, quizSetId } })),
		detach: async (quizSetId: string) =>
			refresh(await detachQuiz({ data: { folderId, quizSetId } })),
		rename: async (name: string) =>
			refresh(await renamePage({ data: { folderId, name } })),
		pickIcon: async (icon: string | undefined) =>
			refresh(await setPageIcon({ data: { folderId, icon } })),
	};
}
