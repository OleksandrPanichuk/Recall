import type { BrowseView } from "@recall/contracts";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { EmptySummary } from "@/components/EmptySummary";
import { LibraryList } from "@/components/LibraryList";
import { PageSummary } from "@/components/PageSummary";
import { SummaryEditor } from "@/components/SummaryEditor";
import { Button } from "@/components/ui/Button";

export interface PageViewProps {
	readonly view: BrowseView;
	readonly saving?: boolean;
	readonly onSave?: (summary: string) => void;
}

export function PageView({ view, saving = false, onSave }: PageViewProps) {
	const [editing, setEditing] = useState(false);
	const hasItems =
		view.children.length > 0 ||
		view.sets.length > 0 ||
		view.attached.length > 0;

	const save = (summary: string) => {
		onSave?.(summary);
		setEditing(false);
	};

	return (
		<div className="space-y-6">
			{editing ? (
				<SummaryEditor
					summary={view.summary ?? ""}
					saving={saving}
					onSave={save}
					onCancel={() => setEditing(false)}
				/>
			) : (
				<div className="space-y-2">
					{view.summary === undefined ? (
						<EmptySummary />
					) : (
						<PageSummary summary={view.summary} />
					)}
					{onSave === undefined ? null : (
						<Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
							<Pencil />
							{view.summary === undefined ? "Написати конспект" : "Редагувати"}
						</Button>
					)}
				</div>
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
