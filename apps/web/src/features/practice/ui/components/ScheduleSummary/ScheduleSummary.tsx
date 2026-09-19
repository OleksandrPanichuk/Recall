import type { ScheduledQuestion } from "@recall/contracts";
import {
	RECALL_GRADE_LABELS,
	RECALL_GRADES,
} from "@/features/practice/constants/recall-grades";
import { gradeCounts, groupByDue } from "./ScheduleSummary.lib";

interface Props {
	readonly scheduled: readonly ScheduledQuestion[];
	readonly today: Date;
}

export function ScheduleSummary({ scheduled, today }: Props) {
	if (scheduled.length === 0) {
		return null;
	}

	const counts = gradeCounts(scheduled);

	return (
		<div className="space-y-4">
			<ul className="flex flex-wrap gap-2 text-sm">
				{RECALL_GRADES.filter((grade) => counts[grade] > 0).map((grade) => (
					<li
						key={grade}
						className="flex items-baseline gap-1.5 rounded-md border border-border px-2.5 py-1"
					>
						<span className="font-semibold tabular-nums">{counts[grade]}</span>
						<span className="text-muted-foreground">
							{RECALL_GRADE_LABELS[grade]}
						</span>
					</li>
				))}
			</ul>
			<div className="space-y-3">
				{groupByDue(scheduled, today).map((group) => (
					<div key={group.label} className="space-y-1">
						<h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
							{group.label}
						</h3>
						<ul className="space-y-0.5 text-sm">
							{group.questions.map((question) => (
								<li key={question.questionId} className="truncate">
									{question.prompt}
								</li>
							))}
						</ul>
					</div>
				))}
			</div>
		</div>
	);
}
