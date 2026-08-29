import type { BrowseView } from "@recall/contracts";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { LibraryList } from "@/components/LibraryList";
import { PageSummary } from "@/components/PageSummary";

const NotionEditor = lazy(async () => ({
	default: (await import("@/components/NotionEditor")).NotionEditor,
}));

export interface PageViewProps {
	readonly view: BrowseView;
	readonly onEdit?: (markdown: string) => void;
}

export function PageView({ view, onEdit }: PageViewProps) {
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
				<ClientOnly fallback={summary}>
					<Suspense fallback={summary}>
						<NotionEditor
							key={view.folderId}
							markdown={view.summary ?? ""}
							onChange={onEdit}
						/>
					</Suspense>
				</ClientOnly>
			)}
			{hasItems ? (
				<section className="space-y-2">
					<h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Всередині
					</h2>
					<LibraryList view={view} />
				</section>
			) : null}
		</div>
	);
}
