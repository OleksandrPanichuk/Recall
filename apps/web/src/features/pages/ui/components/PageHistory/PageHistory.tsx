import type { PageRevision } from "@recall/contracts";
import { History, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { NOTHING_YET } from "./PageHistory.constants";
import {
	changedSince,
	excerptOf,
	sizeOf,
	writtenAt,
	writtenBy,
} from "./PageHistory.lib";

interface Props {
	readonly revisions: readonly PageRevision[];
	readonly current: string;
	readonly busy: boolean;
	readonly onRestore: (summary: string) => void;
}

export function PageHistory({ revisions, current, busy, onRestore }: Props) {
	const [open, setOpen] = useState(false);

	if (!open) {
		return (
			<Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
				<History className="size-3.5" />
				Історія ({revisions.length})
			</Button>
		);
	}

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<h2 className="text-sm font-medium text-muted-foreground">
					Попередні версії
				</h2>
				<Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
					Згорнути
				</Button>
			</div>

			{revisions.length === 0 ? (
				<Alert>{NOTHING_YET}</Alert>
			) : (
				revisions.map((revision) => (
					<Card key={revision.id}>
						<CardContent className="flex items-start gap-3 pt-4">
							<div className="min-w-0 flex-1 space-y-1">
								<div className="flex flex-wrap items-center gap-1.5">
									<span className="text-sm font-medium">
										{writtenAt(revision.createdAt)}
									</span>
									<Badge>{writtenBy(revision.authorKind)}</Badge>
									<span className="text-xs text-muted-foreground">
										{sizeOf(revision.summary)}
									</span>
								</div>
								<p className="truncate text-xs text-muted-foreground">
									{excerptOf(revision.summary)}
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								disabled={busy || !changedSince(revision, current)}
								onClick={() => onRestore(revision.summary ?? "")}
							>
								<RotateCcw className="size-3.5" />
								{changedSince(revision, current) ? "Повернути" : "Це поточна"}
							</Button>
						</CardContent>
					</Card>
				))
			)}
		</div>
	);
}
