import type { Insights } from "@recall/contracts";
import { Card } from "@/components/ui/Card";
import { ActivityHeatmap } from "@/features/statistics/ui/components/ActivityHeatmap";
import { DueForecast } from "@/features/statistics/ui/components/DueForecast";
import { HardestQuestions } from "@/features/statistics/ui/components/HardestQuestions";
import { StatTiles } from "@/features/statistics/ui/components/StatTiles";
import { PageHeading } from "@/shared/ui/components/PageHeading";
import { SignInPrompt } from "@/shared/ui/components/SignInPrompt";
import { insightTiles } from "./InsightsView.constants";

interface Props {
	readonly insights: Insights | null;
}

export function InsightsView({ insights }: Props) {
	if (insights === null) {
		return <SignInPrompt />;
	}

	const today = new Date(`${insights.to}T00:00:00.000Z`);

	return (
		<div className="space-y-8">
			<PageHeading title="Статистика" caption="За останній рік" />

			<StatTiles stats={insightTiles(insights)} />

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
