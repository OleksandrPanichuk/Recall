import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { PageSummary } from "@/features/pages/ui/components/PageSummary";
import { cn } from "@/shared/lib/utils";

const NotionEditor = lazy(async () => ({
	default: (await import("@/features/pages/ui/components/NotionEditor"))
		.NotionEditor,
}));

interface Props {
	readonly markdown: string;
	readonly onEdit: (markdown: string) => void;
}

export function PageEditorSlot({ markdown, onEdit }: Props) {
	const [ready, setReady] = useState(false);
	const summary = <PageSummary summary={markdown} />;

	return (
		<div className="relative">
			{ready ? null : summary}
			<div
				className={cn(
					ready ? "" : "pointer-events-none absolute inset-0 opacity-0",
				)}
			>
				<ClientOnly fallback={null}>
					<Suspense fallback={null}>
						<NotionEditor
							markdown={markdown}
							onChange={onEdit}
							onReady={() => setReady(true)}
						/>
					</Suspense>
				</ClientOnly>
			</div>
		</div>
	);
}
