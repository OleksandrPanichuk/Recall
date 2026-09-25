import type { PageTreeNode } from "@recall/contracts";
import { useRouter } from "@tanstack/react-router";
import { FolderInput } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/Popover";
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
	const destinations = destinationsFor(pages, folderId, parentId);

	const move = async (destination: string | undefined) => {
		setBusy(true);

		try {
			await movePage({ data: { folderId, parentId: destination } });
		} finally {
			setBusy(false);
		}

		setOpen(false);
		onMoved();
		await router.invalidate();
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="sm" disabled={busy}>
					<FolderInput />
					Move
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="max-h-72 w-64 overflow-y-auto p-1">
				{destinations.length === 0 ? (
					<p className="px-2 py-1.5 text-sm text-muted-foreground">
						Nowhere to move it.
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
			</PopoverContent>
		</Popover>
	);
}
