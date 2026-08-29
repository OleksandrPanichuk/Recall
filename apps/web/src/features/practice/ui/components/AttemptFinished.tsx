import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import type { FinishedAttempt } from "@/features/practice/lib/practice.types";
import { ScoreSummary } from "@/features/statistics/ui/components/ScoreSummary";
import { PageHeading } from "@/shared/ui/components/PageHeading";

interface Props {
	readonly finished: FinishedAttempt;
	readonly quizId: string;
}

export function AttemptFinished({ finished, quizId }: Props) {
	return (
		<>
			<PageHeading title="Спроба завершена" />
			<Card>
				<CardContent className="space-y-4 pt-5">
					<ScoreSummary
						score={{
							correct: finished.correct,
							total: finished.total,
							percentage: finished.percentage,
						}}
					/>
					<div className="flex flex-wrap gap-2">
						<Link
							to="/attempts/$attemptId"
							params={{ attemptId: finished.attemptId }}
						>
							<Button>Розібрати відповіді</Button>
						</Link>
						<Link to="/quizzes/$quizId" params={{ quizId }}>
							<Button variant="ghost">До набору</Button>
						</Link>
					</div>
				</CardContent>
			</Card>
		</>
	);
}
