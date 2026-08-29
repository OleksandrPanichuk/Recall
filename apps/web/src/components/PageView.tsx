import type { BrowseView } from "@recall/contracts";
import { EmptySummary } from "@/components/EmptySummary";
import { LibraryList } from "@/components/LibraryList";
import { PageSummary } from "@/components/PageSummary";

export function PageView({ view }: { readonly view: BrowseView }) {
	const hasItems = view.children.length > 0 || view.sets.length > 0;

	return (
		<div className="space-y-6">
			{view.summary === undefined ? (
				<EmptySummary />
			) : (
				<PageSummary summary={view.summary} />
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
