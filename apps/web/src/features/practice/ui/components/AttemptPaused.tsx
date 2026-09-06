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
				<p className="font-medium">Спробу призупинено</p>
				<p className="mt-1 text-sm text-muted-foreground">
					Зупинилися на {index + 1} з {total}. Відповіді поки не приймаються.
				</p>
			</div>
			<Button size="lg" disabled={busy} onClick={onResume}>
				<CirclePlay />
				Продовжити
			</Button>
		</Card>
	);
}
