import type { PageTreeNode } from "@recall/contracts";
import { FolderInput } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/Popover";
import { pageChoices } from "./MoveQuizSet.lib";

interface Props {
	readonly folderId?: string;
	readonly pages: readonly PageTreeNode[];
	readonly busy: boolean;
	readonly onMove: (folderId: string | undefined) => Promise<void>;
}

export function MoveQuizSet({ folderId, pages, busy, onMove }: Props) {
	const [open, setOpen] = useState(false);
	const choices = pageChoices(pages, folderId);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button variant="outline" disabled={busy}>
					<FolderInput />
					File in a page
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="start"
				className="max-h-72 w-64 overflow-y-auto p-1"
			>
				{choices.length === 0 ? (
					<p className="px-2 py-1.5 text-sm text-muted-foreground">
						There are no pages yet.
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
			</PopoverContent>
		</Popover>
	);
}
