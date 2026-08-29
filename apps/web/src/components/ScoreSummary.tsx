import type { Score } from "@recall/contracts";
import { cn } from "@/lib/utils";

export function ScoreSummary({
	score,
	className,
}: {
	readonly score: Score;
	readonly className?: string;
}) {
	return (
		<div className={cn("flex items-baseline gap-2", className)}>
			<span className="text-3xl font-semibold tabular-nums">
				{score.correct}
				<span className="text-muted-foreground">/{score.total}</span>
			</span>
			<span className="text-sm text-muted-foreground">
				{Math.round(score.percentage)}%
			</span>
		</div>
	);
}
