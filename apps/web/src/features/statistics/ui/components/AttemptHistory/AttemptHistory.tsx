import type { AttemptSummary } from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { day } from "./AttemptHistory.lib";

export function AttemptHistory({
	attempts,
}: {
	readonly attempts: readonly AttemptSummary[];
}) {
	return (
		<Card className="divide-y divide-border overflow-hidden">
			{attempts.map((attempt) => (
				<Link
					key={attempt.attemptId}
					to="/attempts/$attemptId"
					params={{ attemptId: attempt.attemptId }}
					className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/60"
				>
					<span className="text-muted-foreground">
						{day(attempt.completedAt)}
					</span>
					<span className="flex items-center gap-2">
						<span className="tabular-nums">
							{attempt.score.correct}/{attempt.score.total}
						</span>
						<span className="text-muted-foreground">
							{Math.round(attempt.score.percentage)}%
						</span>
						<ChevronRight className="size-4 text-muted-foreground" />
					</span>
				</Link>
			))}
		</Card>
	);
}
