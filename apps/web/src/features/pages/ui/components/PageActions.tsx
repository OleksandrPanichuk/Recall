import type { BrowseView, PageTreeNode, QuizSummary } from "@recall/contracts";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { deletePage } from "@/features/pages/lib/pages.api";
import { AttachQuiz } from "@/features/pages/ui/components/AttachQuiz";
import { MovePage } from "@/features/pages/ui/components/MovePage";
import { NewPageButton } from "@/features/pages/ui/components/NewPageButton";
import { SharePage } from "@/features/pages/ui/components/SharePage";

interface Props {
	readonly view: BrowseView;
	readonly pages: readonly PageTreeNode[];
	readonly sets: readonly QuizSummary[];
	readonly onChanged: () => void;
	readonly onFlush: () => Promise<void>;
	readonly onAttach: (quizSetId: string) => Promise<void>;
	readonly onShare: (rotate: boolean) => Promise<void>;
	readonly onUnshare: () => Promise<void>;
}

export function PageActions({
	view,
	pages,
	sets,
	onChanged,
	onFlush,
	onAttach,
	onShare,
	onUnshare,
}: Props) {
	const navigate = useNavigate();
	const [busy, setBusy] = useState(false);
	const empty =
		view.children.length === 0 &&
		view.sets.length === 0 &&
		view.attached.length === 0;

	const remove = async () => {
		setBusy(true);

		try {
			await onFlush();
			await deletePage({ data: view.folderId });
			await navigate(
				view.parentId === undefined
					? { to: "/" }
					: { to: "/folders/$folderId", params: { folderId: view.parentId } },
			);
			onChanged();
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex items-center gap-1">
			<NewPageButton
				parentId={view.folderId}
				label="Subpage"
				onCreated={onChanged}
			/>
			{view.folderId === undefined ? null : (
				<>
					<SharePage
						token={view.shareToken}
						busy={busy}
						onShare={onShare}
						onUnshare={onUnshare}
					/>
					<AttachQuiz view={view} sets={sets} onAttach={onAttach} />
					<MovePage
						folderId={view.folderId}
						parentId={view.parentId}
						pages={pages}
						onMoved={onChanged}
					/>
				</>
			)}
			{empty ? (
				<Button
					variant="ghost"
					size="sm"
					onClick={remove}
					disabled={busy}
					aria-label="Delete page"
				>
					<Trash2 />
				</Button>
			) : null}
		</div>
	);
}
