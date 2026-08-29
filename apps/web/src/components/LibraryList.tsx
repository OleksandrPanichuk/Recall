import type { BrowseView } from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Folder, Layers } from "lucide-react";
import { Card } from "@/components/ui/Card";

const row =
	"flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-accent/60";

export function LibraryList({ view }: { readonly view: BrowseView }) {
	const shown = view.attached.filter(
		(set) => !view.sets.some((filed) => filed.id === set.id),
	);

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
			{[...view.sets, ...shown].map((set) => (
				<Link
					key={set.id}
					to="/quizzes/$quizId"
					params={{ quizId: set.id }}
					className={row}
				>
					<span className="flex min-w-0 items-center gap-3">
						<Layers className="size-4 shrink-0 text-muted-foreground" />
						<span className="truncate font-medium">{set.title}</span>
					</span>
					<span className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
						{set.questionCount} питань
						<ChevronRight className="size-4" />
					</span>
				</Link>
			))}
		</Card>
	);
}
