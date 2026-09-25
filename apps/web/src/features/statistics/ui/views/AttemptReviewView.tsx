import type { AttemptDetail } from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AnsweredQuestion } from "@/features/statistics/ui/components/AnsweredQuestion";
import { ScoreSummary } from "@/features/statistics/ui/components/ScoreSummary";
import { BackLink } from "@/shared/ui/components/BackLink";
import { PageHeading } from "@/shared/ui/components/PageHeading";
import { SignInPrompt } from "@/shared/ui/components/SignInPrompt";

interface Props {
	readonly attempt: AttemptDetail | null;
}

export function AttemptReviewView({ attempt }: Props) {
	if (attempt === null) {
		return <SignInPrompt />;
	}

	return (
		<>
			<BackLink quizId={attempt.quizSetId} label={attempt.quizSetTitle} />
			<PageHeading title={attempt.quizSetTitle}>
				<ScoreSummary score={attempt.score} />
			</PageHeading>

			<div className="space-y-3">
				{attempt.answers.map((answer) => (
					<AnsweredQuestion key={answer.question.id} answer={answer} />
				))}
			</div>

			<Button asChild variant="ghost" className="mt-6">
				<Link to="/quizzes/$quizId" params={{ quizId: attempt.quizSetId }}>
					<ArrowLeft />
					back to quiz
				</Link>
			</Button>
		</>
	);
}
