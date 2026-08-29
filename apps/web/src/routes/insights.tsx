import { createFileRoute } from "@tanstack/react-router";
import { Flame, ListChecks, Target } from "lucide-react";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";
import { DueForecast } from "@/components/DueForecast";
import { HardestQuestions } from "@/components/HardestQuestions";
import { PageHeading } from "@/components/PageHeading";
import { SignInPrompt } from "@/components/SignInPrompt";
import { StatTiles } from "@/components/StatTiles";
import { Card } from "@/components/ui/Card";
import { loadInsights } from "@/lib/practice";

export const Route = createFileRoute("/insights")({
	loader: async ({ context }) =>
		context.viewer === null ? null : loadInsights(),
	component: Insights,
});

function Insights() {
	const insights = Route.useLoaderData();

	if (insights === null) {
		return <SignInPrompt />;
	}

	const today = new Date(`${insights.to}T00:00:00.000Z`);
	const accuracy =
		insights.answered === 0
			? "—"
			: `${Math.round((insights.correct / insights.answered) * 100)}%`;

	return (
		<div className="space-y-8">
			<PageHeading title="Статистика" caption="За останній рік" />

			<StatTiles
				stats={[
					{
						label: "Серія",
						value: `${insights.streak}`,
						hint: insights.streak === 0 ? "почніть сьогодні" : "днів поспіль",
						icon: <Flame className="size-3.5" />,
					},
					{
						label: "Відповідей",
						value: `${insights.answered}`,
						icon: <ListChecks className="size-3.5" />,
					},
					{
						label: "Точність",
						value: accuracy,
						hint:
							insights.answered === 0
								? undefined
								: `${insights.correct} правильних`,
						icon: <Target className="size-3.5" />,
					},
				]}
			/>

			<Card className="p-5">
				<ActivityHeatmap activity={insights.activity} today={today} />
			</Card>

			<Card className="p-5">
				<DueForecast forecast={insights.forecast} today={today} />
			</Card>

			<section className="space-y-3">
				<h2 className="text-sm font-medium text-muted-foreground">
					Дається найважче
				</h2>
				<HardestQuestions hardest={insights.hardest} />
			</section>
		</div>
	);
}
