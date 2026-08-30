import type { BrowseView } from "@recall/contracts";
import { LibraryList } from "@/features/pages/ui/components/LibraryList";
import { PageEditorSlot } from "@/features/pages/ui/components/PageEditorSlot";
import { PageSummary } from "@/features/pages/ui/components/PageSummary";

interface Props {
	readonly view: BrowseView;
	readonly onEdit?: (markdown: string) => void;
	readonly inProgressQuizId?: string;
}

export function PageBody({ view, onEdit, inProgressQuizId }: Props) {
	const hasItems =
		view.children.length > 0 ||
		view.sets.length > 0 ||
		view.attached.length > 0;
	const summary = <PageSummary summary={view.summary ?? ""} />;

	return (
		<div className="space-y-8">
			{onEdit === undefined ? (
				summary
			) : (
				<PageEditorSlot
					key={view.folderId}
					markdown={view.summary ?? ""}
					onEdit={onEdit}
				/>
			)}
			{hasItems ? (
				<section className="space-y-2">
					<h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Всередині
					</h2>
					<LibraryList view={view} inProgressQuizId={inProgressQuizId} />
				</section>
			) : null}
		</div>
	);
}
