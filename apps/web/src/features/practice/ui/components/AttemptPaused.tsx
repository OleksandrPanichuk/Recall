import { CirclePlay } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface Props {
	readonly index: number;
	readonly total: number;
	readonly busy: boolean;
	readonly onResume: () => Promise<void>;
}

export function AttemptPaused({ index, total, busy, onResume }: Props) {
	return (
		<Card className="space-y-4 p-8 text-center">
			<div>
				<p className="font-medium">Attempt paused</p>
				<p className="mt-1 text-sm text-muted-foreground">
					You stopped at {index + 1} of {total}. Answers are not being taken.
				</p>
			</div>
			<Button size="lg" disabled={busy} onClick={onResume}>
				<CirclePlay />
				Resume
			</Button>
		</Card>
	);
}
