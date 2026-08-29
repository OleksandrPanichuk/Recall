import { ClientOnly } from "@tanstack/react-router";
import { Save, X } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const NotionEditor = lazy(async () => ({
	default: (await import("@/components/NotionEditor")).NotionEditor,
}));

const loading = (
	<p className="px-4 py-3 text-sm text-muted-foreground">
		Редактор завантажується…
	</p>
);

export interface SummaryEditorProps {
	readonly summary: string;
	readonly saving: boolean;
	readonly onSave: (summary: string) => void;
	readonly onCancel: () => void;
}

export function SummaryEditor({
	summary,
	saving,
	onSave,
	onCancel,
}: SummaryEditorProps) {
	const [read, setRead] = useState<(() => string) | null>(null);
	const [dirty, setDirty] = useState(false);

	return (
		<div className="space-y-3">
			<Card className="overflow-hidden">
				<ClientOnly fallback={loading}>
					<Suspense fallback={loading}>
						<NotionEditor
							markdown={summary}
							onReady={(reader) => setRead(() => reader)}
							onChange={() => setDirty(true)}
						/>
					</Suspense>
				</ClientOnly>
			</Card>
			<div className="flex flex-wrap items-center gap-2">
				<Button
					onClick={() => onSave(read === null ? summary : read())}
					disabled={saving || read === null}
				>
					<Save />
					{saving ? "Збереження…" : "Зберегти"}
				</Button>
				<Button variant="ghost" onClick={onCancel} disabled={saving}>
					<X />
					Скасувати
				</Button>
				{dirty && !saving ? (
					<span className="text-xs text-muted-foreground">
						Незбережені зміни
					</span>
				) : null}
			</div>
		</div>
	);
}
