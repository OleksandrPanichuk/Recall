import type { BrowseView, PageRevision, PageTreeNode } from "@recall/contracts";
import { usePageEditing } from "@/features/pages/hooks/use-page-editing";
import { EmojiPicker } from "@/features/pages/ui/components/EmojiPicker";
import { PageActions } from "@/features/pages/ui/components/PageActions";
import { PageBody } from "@/features/pages/ui/components/PageBody";
import { PageBreadcrumb } from "@/features/pages/ui/components/PageBreadcrumb";
import { PageHistory } from "@/features/pages/ui/components/PageHistory";
import { PageTitle } from "@/features/pages/ui/components/PageTitle";
import { NotFound } from "@/shared/ui/components/NotFound";
import { SaveState } from "@/shared/ui/components/SaveState";
import { SignInPrompt } from "@/shared/ui/components/SignInPrompt";

interface Props {
	readonly folderId: string;
	readonly page: BrowseView | null;
	readonly inProgressQuizId?: string;
	readonly pages: readonly PageTreeNode[];
	readonly signedIn: boolean;
	readonly revisions: readonly PageRevision[];
}

export function PageDetailView({
	folderId,
	page,
	inProgressQuizId,
	pages,
	signedIn,
	revisions,
}: Props) {
	const editing = usePageEditing(folderId, page);

	if (editing.view === null) {
		return signedIn ? <NotFound /> : <SignInPrompt />;
	}

	const view = editing.view;

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<PageBreadcrumb crumbs={view.breadcrumb} />
				<div className="flex items-center gap-2">
					<SaveState state={editing.state} />
					<PageActions
						view={view}
						pages={pages}
						onChanged={editing.invalidate}
						onFlush={editing.flush}
					/>
				</div>
			</div>
			<div className="flex items-start gap-2">
				<EmojiPicker icon={view.icon} onPick={editing.pickIcon} />
				<div className="min-w-0 flex-1 pt-1.5">
					<PageTitle name={view.name ?? ""} onRename={editing.rename} />
				</div>
			</div>
			<PageBody
				view={view}
				onEdit={editing.schedule}
				inProgressQuizId={inProgressQuizId}
				resetKey={editing.restored}
			/>
			<PageHistory
				revisions={revisions}
				current={view.summary ?? ""}
				busy={editing.state === "saving"}
				onRestore={editing.restore}
			/>
		</div>
	);
}
