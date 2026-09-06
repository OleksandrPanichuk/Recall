import type { BrowseView } from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Folder, Layers, Unlink } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { row } from "./LibraryList.constants";

interface Props {
	readonly view: BrowseView;
	readonly inProgressQuizId?: string;
	readonly onDetach?: (quizSetId: string) => Promise<void>;
}

export function LibraryList({ view, inProgressQuizId, onDetach }: Props) {
	const [detaching, setDetaching] = useState<string>();
	const shown = view.attached.filter(
		(set) => !view.sets.some((filed) => filed.id === set.id),
	);
	const attachedIds = new Set(shown.map((set) => set.id));

	if (
		view.children.length === 0 &&
		view.sets.length === 0 &&
		shown.length === 0
	) {
		return (
			<Card className="p-8 text-center text-sm text-muted-foreground">
				Тут поки порожньо. Створіть набір через бота або MCP.
			</Card>
		);
	}

	return (
		<Card className="divide-y divide-border overflow-hidden">
			{view.children.map((folder) => (
				<Link
					key={folder.id}
					to="/folders/$folderId"
					params={{ folderId: folder.id }}
					className={row}
				>
					<span className="flex min-w-0 items-center gap-3">
						<Folder className="size-4 shrink-0 text-muted-foreground" />
						<span className="truncate font-medium">{folder.name}</span>
					</span>
					<span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
						{folder.itemCount}
						<ChevronRight className="size-4" />
					</span>
				</Link>
			))}
			{[...view.sets, ...shown].map((set) => {
				const detachable = onDetach !== undefined && attachedIds.has(set.id);

				return (
					<div key={set.id} className="flex items-center">
						<Link
							to="/quizzes/$quizId"
							params={{ quizId: set.id }}
							className={`${row} min-w-0 flex-1`}
						>
							<span className="flex min-w-0 items-center gap-3">
								<Layers className="size-4 shrink-0 text-muted-foreground" />
								<span className="truncate font-medium">{set.title}</span>
							</span>
							<span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
								{set.id === inProgressQuizId ? (
									<Badge variant="outline">почато</Badge>
								) : null}
								{set.questionCount} питань
								{detachable ? null : <ChevronRight className="size-4" />}
							</span>
						</Link>
						{detachable ? (
							<Button
								variant="ghost"
								size="sm"
								className="mr-2 shrink-0"
								disabled={detaching === set.id}
								aria-label={`Відкріпити ${set.title}`}
								onClick={async () => {
									setDetaching(set.id);

									try {
										await onDetach(set.id);
									} finally {
										setDetaching(undefined);
									}
								}}
							>
								<Unlink />
							</Button>
						) : null}
					</div>
				);
			})}
		</Card>
	);
}
