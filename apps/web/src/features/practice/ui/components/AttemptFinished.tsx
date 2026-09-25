import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import type { FinishedAttempt } from "@/features/practice/lib/practice.types";
import type { PracticeSearchMode } from "@/features/practice/lib/practice-mode";
import { ScheduleSummary } from "@/features/practice/ui/components/ScheduleSummary";
import { ScoreSummary } from "@/features/statistics/ui/components/ScoreSummary";
import { PageHeading } from "@/shared/ui/components/PageHeading";

interface Props {
	readonly finished: FinishedAttempt;
	readonly quizId: string;
	readonly mode?: PracticeSearchMode;
}

export function AttemptFinished({ finished, quizId, mode }: Props) {
	const missed = finished.correct < finished.total;
	const nextDue = finished.nextDue;

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
					{mode === "due" && nextDue === null ? (
						<p className="text-sm text-muted-foreground">
							That was everything due today.
						</p>
					) : null}
					<div className="flex flex-wrap gap-2">
						{nextDue === null ? null : (
							<Button asChild>
								<Link
									to="/practice/$quizId"
									params={{ quizId: nextDue.quizSetId }}
									search={{ mode: "due" }}
								>
									Next: {nextDue.title} ({nextDue.dueCount} due)
								</Link>
							</Button>
						)}
						{missed ? (
							<Button
								asChild
								variant={nextDue === null ? "default" : "outline"}
							>
								<Link
									to="/practice/$quizId"
									params={{ quizId }}
									search={{ mode: "mistakes" }}
								>
									Retry the ones you missed
								</Link>
							</Button>
						) : null}
						<Button
							asChild
							variant={missed || nextDue !== null ? "outline" : "default"}
						>
							<Link
								to="/attempts/$attemptId"
								params={{ attemptId: finished.attemptId }}
							>
								Go through the answers
							</Link>
						</Button>
						<Button asChild variant="ghost">
							<Link to="/quizzes/$quizId" params={{ quizId }}>
								Back to quiz
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		</>
	);
}
