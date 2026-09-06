import type { PageTreeNode } from "@recall/contracts";
import { FolderInput } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { pageChoices } from "./MoveQuizSet.lib";

interface Props {
	readonly folderId?: string;
	readonly pages: readonly PageTreeNode[];
	readonly busy: boolean;
	readonly onMove: (folderId: string | undefined) => Promise<void>;
}

export function MoveQuizSet({ folderId, pages, busy, onMove }: Props) {
	const [open, setOpen] = useState(false);
	const box = useRef<HTMLDivElement>(null);
	const choices = pageChoices(pages, folderId);

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

	return (
		<div ref={box} className="relative">
			<Button variant="outline" disabled={busy} onClick={() => setOpen(!open)}>
				<FolderInput />
				До сторінки
			</Button>
			{open ? (
				<div className="absolute left-0 z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
					{choices.length === 0 ? (
						<p className="px-2 py-1.5 text-sm text-muted-foreground">
							Ще немає жодної сторінки.
						</p>
					) : (
						choices.map((choice) => (
							<button
								key={choice.id ?? "library"}
								type="button"
								disabled={busy}
								onClick={async () => {
									await onMove(choice.id);
									setOpen(false);
								}}
								className="block w-full truncate rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
								style={{ paddingLeft: `${0.5 + choice.depth * 0.75}rem` }}
							>
								{choice.name}
							</button>
						))
					)}
				</div>
			) : null}
		</div>
	);
}
