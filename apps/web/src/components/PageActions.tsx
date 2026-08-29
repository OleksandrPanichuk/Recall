import type { BrowseView } from "@recall/contracts";
import { useNavigate } from "@tanstack/react-router";
import { FilePlus2, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { createPage, deletePage } from "@/lib/practice";

export interface PageActionsProps {
	readonly view: BrowseView;
	readonly onChanged: () => void;
	readonly onFlush: () => Promise<void>;
}

export function PageActions({ view, onChanged, onFlush }: PageActionsProps) {
	const navigate = useNavigate();
	const [busy, setBusy] = useState(false);
	const empty =
		view.children.length === 0 &&
		view.sets.length === 0 &&
		view.attached.length === 0;

	const add = async () => {
		setBusy(true);

		try {
			const { folderId } = await createPage({
				data: { name: "Без назви", parentId: view.folderId },
			});

			await navigate({ to: "/folders/$folderId", params: { folderId } });
		} finally {
			setBusy(false);
		}
	};

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
			<Button variant="ghost" size="sm" onClick={add} disabled={busy}>
				<FilePlus2 />
				Підсторінка
			</Button>
			{empty ? (
				<Button
					variant="ghost"
					size="sm"
					onClick={remove}
					disabled={busy}
					aria-label="Видалити сторінку"
				>
					<Trash2 />
				</Button>
			) : null}
		</div>
	);
}
