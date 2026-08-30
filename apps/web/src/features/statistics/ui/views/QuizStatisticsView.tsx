import type {
	CurrentQuestionView,
	QuizStatistics,
	ResolvedQuizSettings,
} from "@recall/contracts";
import { Link } from "@tanstack/react-router";
import { CirclePlay, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SettingsEditor } from "@/features/settings/ui/components/SettingsEditor";
import { quizCallToAction } from "@/features/statistics/lib/quiz-page";
import { AttemptHistory } from "@/features/statistics/ui/components/AttemptHistory";
import { QuizAccuracyCard } from "@/features/statistics/ui/components/QuizAccuracyCard";
import { TopicAccuracyList } from "@/features/statistics/ui/components/TopicAccuracyList";
import { NotFound } from "@/shared/ui/components/NotFound";
import { PageHeading } from "@/shared/ui/components/PageHeading";
import { SignInPrompt } from "@/shared/ui/components/SignInPrompt";

interface Props {
	readonly quizId: string;
	readonly statistics: QuizStatistics | null;
	readonly settings: ResolvedQuizSettings | null;
	readonly active: CurrentQuestionView | null;
	readonly signedIn: boolean;
}

export function QuizStatisticsView({
	quizId,
	statistics,
	settings,
	active,
	signedIn,
}: Props) {
	if (statistics === null) {
		return signedIn ? <NotFound /> : <SignInPrompt />;
	}

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
					<QuizAccuracyCard
						score={statistics.setAccuracy}
						improvement={statistics.improvement}
					/>

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
