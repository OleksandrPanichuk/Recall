import { createFileRoute, Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { AttemptHistory } from "@/components/AttemptHistory";
import { NotFound } from "@/components/NotFound";
import { PageHeading } from "@/components/PageHeading";
import { ScoreSummary } from "@/components/ScoreSummary";
import { SignInPrompt } from "@/components/SignInPrompt";
import { TopicAccuracyList } from "@/components/TopicAccuracyList";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { loadStatistics } from "@/lib/practice";

export const Route = createFileRoute("/quizzes/$quizId")({
	loader: async ({ context, params }) =>
		context.viewer === null ? null : loadStatistics({ data: params.quizId }),
	component: Quiz,
});

function Quiz() {
	const statistics = Route.useLoaderData();
	const context = Route.useRouteContext();
	const { quizId } = Route.useParams();

	if (statistics === null) {
		return context.viewer === null ? <SignInPrompt /> : <NotFound />;
	}

	const attempts = statistics.attempts.length;

	return (
		<>
			<PageHeading
				title={statistics.title}
				caption={attempts === 0 ? "Ще жодної спроби" : `${attempts} спроб(и)`}
			>
				<Link to="/practice/$quizId" params={{ quizId }}>
					<Button size="lg">
						<Play />
						{attempts === 0 ? "Почати" : "Пройти ще раз"}
					</Button>
				</Link>
			</PageHeading>

			{attempts > 0 ? (
				<div className="space-y-6">
					<Card>
						<CardContent className="flex items-end justify-between gap-4 pt-5">
							<div>
								<p className="text-sm text-muted-foreground">
									Середня точність
								</p>
								<ScoreSummary score={statistics.setAccuracy} />
							</div>
							{statistics.improvement === undefined ? null : (
								<p className="text-sm text-muted-foreground">
									перша {Math.round(statistics.improvement.firstPercentage)}% →
									остання {Math.round(statistics.improvement.lastPercentage)}%
								</p>
							)}
						</CardContent>
					</Card>

					<section className="space-y-3">
						<h2 className="text-sm font-medium text-muted-foreground">
							Спроби
						</h2>
						<AttemptHistory attempts={statistics.attempts} />
					</section>

					{statistics.topics.length > 0 ? (
						<section className="space-y-3">
							<h2 className="text-sm font-medium text-muted-foreground">
								Теми
							</h2>
							<TopicAccuracyList topics={statistics.topics} />
						</section>
					) : null}
				</div>
			) : null}
		</>
	);
}
