import { createFileRoute, Link } from "@tanstack/react-router";
import { CirclePlay, Play } from "lucide-react";
import { AttemptHistory } from "@/components/AttemptHistory";
import { NotFound } from "@/components/NotFound";
import { PageHeading } from "@/components/PageHeading";
import { ScoreSummary } from "@/components/ScoreSummary";
import { SettingsEditor } from "@/components/SettingsEditor";
import { SignInPrompt } from "@/components/SignInPrompt";
import { TopicAccuracyList } from "@/components/TopicAccuracyList";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import {
	loadCurrentQuestion,
	loadSettings,
	loadStatistics,
} from "@/lib/practice";
import { quizCallToAction } from "@/lib/quiz-page";

export const Route = createFileRoute("/quizzes/$quizId")({
	loader: async ({ context, params }) => {
		if (context.viewer === null) {
			return null;
		}

		const [statistics, settings, active] = await Promise.all([
			loadStatistics({ data: params.quizId }),
			loadSettings({ data: params.quizId }),
			loadCurrentQuestion(),
		]);

		return statistics === null
			? null
			: {
					statistics,
					settings,
					active:
						active.current?.quizSetId === params.quizId ? active.current : null,
				};
	},
	component: Quiz,
});

function Quiz() {
	const loaded = Route.useLoaderData();
	const context = Route.useRouteContext();
	const { quizId } = Route.useParams();

	if (loaded === null) {
		return context.viewer === null ? <SignInPrompt /> : <NotFound />;
	}

	const { statistics, settings, active } = loaded;

	const attempts = statistics.attempts.length;
	const action = quizCallToAction(attempts, active);

	return (
		<>
			<PageHeading title={statistics.title} caption={action.caption}>
				<Link to="/practice/$quizId" params={{ quizId }}>
					<Button size="lg">
						{action.resuming ? <CirclePlay /> : <Play />}
						{action.label}
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

			{settings === null ? null : (
				<section className="mt-8 space-y-3">
					<h2 className="text-sm font-medium text-muted-foreground">
						Налаштування набору
					</h2>
					<SettingsEditor initial={settings} quizSetId={quizId} />
				</section>
			)}
		</>
	);
}
