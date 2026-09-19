import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import type { FinishedAttempt } from "@/features/practice/lib/practice.types";
import { ScheduleSummary } from "@/features/practice/ui/components/ScheduleSummary";
import { ScoreSummary } from "@/features/statistics/ui/components/ScoreSummary";
import { PageHeading } from "@/shared/ui/components/PageHeading";

interface Props {
	readonly finished: FinishedAttempt;
	readonly quizId: string;
}

export function AttemptFinished({ finished, quizId }: Props) {
	return (
		<>
			<PageHeading title="Attempt finished" />
			<Card>
				<CardContent className="space-y-4 pt-5">
					<ScoreSummary
						score={{
							correct: finished.correct,
							total: finished.total,
							percentage: finished.percentage,
						}}
					/>
					{finished.mode === "full" ? null : (
						<p className="text-sm text-muted-foreground">
							Practice attempts do not change the schedule.
						</p>
					)}
					{finished.scheduled.length === 0 ? null : (
						<ScheduleSummary
							scheduled={finished.scheduled}
							today={new Date()}
						/>
					)}
					<div className="flex flex-wrap gap-2">
						<Link
							to="/attempts/$attemptId"
							params={{ attemptId: finished.attemptId }}
						>
							<Button>Go through the answers</Button>
						</Link>
						<Link to="/quizzes/$quizId" params={{ quizId }}>
							<Button variant="ghost">Back to quiz</Button>
						</Link>
					</div>
				</CardContent>
			</Card>
		</>
	);
}
