import type { PageTreeNode } from "@recall/contracts";
import { useRouter } from "@tanstack/react-router";
import { FolderInput } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { movePage } from "@/features/pages/lib/pages.api";
import { destinationsFor } from "./MovePage.lib";

interface Props {
	readonly folderId: string;
	readonly parentId?: string;
	readonly pages: readonly PageTreeNode[];
	readonly onMoved: () => void;
}

export function MovePage({ folderId, parentId, pages, onMoved }: Props) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const destinations = destinationsFor(pages, folderId, parentId);

	useEffect(() => {
		if (!open) {
			return;
		}

		const close = (event: MouseEvent) => {
			if (!box.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		};

		document.addEventListener("mousedown", close);

		return () => document.removeEventListener("mousedown", close);
	}, [open]);

	const move = async (destination: string | undefined) => {
		setBusy(true);

		try {
			await movePage({ data: { folderId, parentId: destination } });
			setOpen(false);
			onMoved();
			await router.invalidate();
		} finally {
			setBusy(false);
		}
	};

	return (
		<div ref={box} className="relative">
			<Button
				variant="ghost"
				size="sm"
				disabled={busy}
				onClick={() => setOpen(!open)}
			>
				<FolderInput />
				Перемістити
			</Button>
			{open ? (
				<div className="absolute right-0 z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
					{destinations.length === 0 ? (
						<p className="px-2 py-1.5 text-sm text-muted-foreground">
							Немає куди переміщати.
						</p>
					) : (
						destinations.map((destination) => (
							<button
								key={destination.id ?? "root"}
								type="button"
								disabled={busy}
								onClick={() => move(destination.id)}
								className="block w-full truncate rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
								style={{ paddingLeft: `${0.5 + destination.depth * 0.75}rem` }}
							>
								{destination.name}
							</button>
						))
					)}
				</div>
			) : null}
		</div>
	);
}
