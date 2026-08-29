import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { AnsweredQuestion } from "@/components/AnsweredQuestion";
import { BackLink } from "@/components/BackLink";
import { PageHeading } from "@/components/PageHeading";
import { ScoreSummary } from "@/components/ScoreSummary";
import { SignInPrompt } from "@/components/SignInPrompt";
import { Button } from "@/components/ui/Button";
import { loadAttempt } from "@/lib/practice";

export const Route = createFileRoute("/attempts/$attemptId")({
	loader: async ({ context, params }) =>
		context.viewer === null ? null : loadAttempt({ data: params.attemptId }),
	component: AttemptReview,
});

function AttemptReview() {
	const attempt = Route.useLoaderData();

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

			<Link
				to="/quizzes/$quizId"
				params={{ quizId: attempt.quizSetId }}
				className="mt-6 inline-block"
			>
				<Button variant="ghost">
					<ArrowLeft />
					до набору
				</Button>
			</Link>
		</>
	);
}
