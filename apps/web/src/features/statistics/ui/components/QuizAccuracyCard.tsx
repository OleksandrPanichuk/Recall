import type { QuizStatistics } from "@recall/contracts";
import { Card, CardContent } from "@/components/ui/Card";
import { ScoreSummary } from "@/features/statistics/ui/components/ScoreSummary";

interface Props {
	readonly score: QuizStatistics["setAccuracy"];
	readonly improvement: QuizStatistics["improvement"];
}

export function QuizAccuracyCard({ score, improvement }: Props) {
	return (
		<Card>
			<CardContent className="flex items-end justify-between gap-4 pt-5">
				<div>
					<p className="text-sm text-muted-foreground">Average accuracy</p>
					<ScoreSummary score={score} />
				</div>
				{improvement === undefined ? null : (
					<p className="text-sm text-muted-foreground">
						first {Math.round(improvement.firstPercentage)}% → latest{" "}
						{Math.round(improvement.lastPercentage)}%
					</p>
				)}
			</CardContent>
		</Card>
	);
}
