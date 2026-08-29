import { NotebookPen } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function EmptySummary() {
	return (
		<Card className="flex items-start gap-3 border-dashed bg-transparent px-6 py-5 text-sm text-muted-foreground">
			<NotebookPen className="mt-0.5 size-4 shrink-0" />
			<p>
				У цієї сторінки ще немає конспекту. Попросіть AI написати його через MCP
				— інструмент{" "}
				<code className="font-mono text-xs">quiz_write_summary</code>.
			</p>
		</Card>
	);
}
