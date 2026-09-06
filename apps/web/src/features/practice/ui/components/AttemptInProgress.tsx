import { Link } from "@tanstack/react-router";
import { CirclePlay, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface Props {
	readonly title: string | null;
	readonly quizSetId: string | null;
	readonly onAbandon: () => Promise<void>;
}

export function AttemptInProgress({ title, quizSetId, onAbandon }: Props) {
	const [busy, setBusy] = useState(false);

	return (
		<Card className="space-y-4 p-8 text-center">
			<div>
				<p className="font-medium">Finish the attempt you already started</p>
				<p className="mt-1 text-sm text-muted-foreground">
					{title === null
						? "You started another quiz and never finished it."
						: `You started “${title}” and never finished it.`}
				</p>
			</div>
			<div className="flex flex-wrap justify-center gap-2">
				{quizSetId === null ? null : (
					<Link to="/practice/$quizId" params={{ quizId: quizSetId }}>
						<Button>
							<CirclePlay />
							Carry on with that one
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
					{busy ? "Abandoning…" : "Abandon it and start this quiz"}
				</Button>
			</div>
		</Card>
	);
}
