import { Link } from "@tanstack/react-router";
import { CirclePlay, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export interface AttemptInProgressProps {
	readonly title: string | null;
	readonly quizSetId: string | null;
	readonly onAbandon: () => Promise<void>;
}

export function AttemptInProgress({
	title,
	quizSetId,
	onAbandon,
}: AttemptInProgressProps) {
	const [busy, setBusy] = useState(false);

	return (
		<Card className="space-y-4 p-8 text-center">
			<div>
				<p className="font-medium">Спершу завершіть попередню спробу</p>
				<p className="mt-1 text-sm text-muted-foreground">
					{title === null
						? "Ви вже почали інший набір і не завершили його."
						: `Ви вже почали «${title}» і не завершили цей набір.`}
				</p>
			</div>
			<div className="flex flex-wrap justify-center gap-2">
				{quizSetId === null ? null : (
					<Link to="/practice/$quizId" params={{ quizId: quizSetId }}>
						<Button>
							<CirclePlay />
							Продовжити ту спробу
						</Button>
					</Link>
				)}
				<Button
					variant="outline"
					disabled={busy}
					onClick={async () => {
						setBusy(true);

						try {
							await onAbandon();
						} finally {
							setBusy(false);
						}
					}}
				>
					<Trash2 />
					{busy ? "Скасовуємо…" : "Скасувати її та почати цей набір"}
				</Button>
			</div>
		</Card>
	);
}
