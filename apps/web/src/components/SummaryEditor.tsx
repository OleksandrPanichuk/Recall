import { Eye, Pencil, Save, X } from "lucide-react";
import { useState } from "react";
import { PageSummary } from "@/components/PageSummary";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";

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
	const [draft, setDraft] = useState(summary);
	const [previewing, setPreviewing] = useState(false);

	return (
		<div className="space-y-3">
			{previewing ? (
				<PageSummary summary={draft} />
			) : (
				<Card className="p-2">
					<Textarea
						aria-label="Конспект"
						value={draft}
						onChange={(event) => setDraft(event.target.value)}
						placeholder="# Заголовок&#10;&#10;Текст у Markdown."
					/>
				</Card>
			)}
			<div className="flex flex-wrap items-center gap-2">
				<Button onClick={() => onSave(draft)} disabled={saving}>
					<Save />
					{saving ? "Збереження…" : "Зберегти"}
				</Button>
				<Button
					variant="outline"
					onClick={() => setPreviewing(!previewing)}
					disabled={saving}
				>
					{previewing ? <Pencil /> : <Eye />}
					{previewing ? "Редагувати" : "Перегляд"}
				</Button>
				<Button variant="ghost" onClick={onCancel} disabled={saving}>
					<X />
					Скасувати
				</Button>
			</div>
		</div>
	);
}
