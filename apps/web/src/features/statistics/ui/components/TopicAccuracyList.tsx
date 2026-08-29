import type { QuizStatistics } from "@recall/contracts";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";

export function TopicAccuracyList({
	topics,
}: {
	readonly topics: QuizStatistics["topics"];
}) {
	return (
		<Card className="divide-y divide-border overflow-hidden">
			{topics.map((topic) => {
				const share =
					topic.answered === 0 ? 0 : (topic.correct / topic.answered) * 100;

				return (
					<div key={topic.topic ?? "—"} className="space-y-2 px-4 py-3">
						<div className="flex items-center justify-between gap-3 text-sm">
							<span className="truncate">{topic.topic ?? "Без теми"}</span>
							<span className="shrink-0 tabular-nums text-muted-foreground">
								{topic.correct}/{topic.answered}
							</span>
						</div>
						<Progress value={share} />
					</div>
				);
			})}
		</Card>
	);
}
