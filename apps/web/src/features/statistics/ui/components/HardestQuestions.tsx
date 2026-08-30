import type { QuestionStat } from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/Card";
import { percentage } from "./HardestQuestions.lib";

export function HardestQuestions({
	hardest,
}: {
	readonly hardest: readonly QuestionStat[];
}) {
	if (hardest.length === 0) {
		return (
			<Card className="p-8 text-center text-sm text-muted-foreground">
				Замало відповідей, щоб сказати, що дається важче.
			</Card>
		);
	}

	return (
		<Card className="viz divide-y divide-border overflow-hidden">
			{hardest.map((stat) => (
				<div key={stat.questionId} className="px-4 py-3.5">
					<div className="flex items-baseline justify-between gap-3">
						<p className="min-w-0 text-sm">{stat.prompt}</p>
						<span className="shrink-0 text-sm tabular-nums text-muted-foreground">
							{percentage(stat)}%
						</span>
					</div>
					<div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
						<div
							className="h-full rounded-full"
							style={{
								width: `${Math.max(2, percentage(stat))}%`,
								background: "var(--viz-series)",
							}}
						/>
					</div>
					<p className="mt-1.5 text-xs text-muted-foreground">
						<Link
							to="/quizzes/$quizId"
							params={{ quizId: stat.quizSetId }}
							className="hover:underline"
						>
							{stat.quizSetTitle}
						</Link>
						{" · "}
						{stat.correct} з {stat.answered}
						{stat.lapses === 0 ? null : ` · ${stat.lapses} відкотів`}
					</p>
				</div>
			))}
		</Card>
	);
}
