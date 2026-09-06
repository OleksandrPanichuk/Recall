import type { DailyActivity } from "@recall/contracts";
import { answers, weeks as countedWeeks } from "@/shared/lib/plural";
import {
	CHART_HEIGHT,
	CHART_PADDING,
	CHART_WIDTH,
	MIN_ANSWERS_PER_WEEK,
} from "./AccuracyTrend.constants";
import { pointsFor, trendBetween, weeklyAccuracy } from "./AccuracyTrend.lib";

interface Props {
	readonly activity: readonly DailyActivity[];
}

const percent = (value: number): string => `${Math.round(value * 100)}%`;

const shortDay = (day: string): string => day.slice(5).replace("-", ".");

export function AccuracyTrend({ activity }: Props) {
	const weeks = weeklyAccuracy(activity);

	if (weeks.length < 2) {
		return (
			<div className="space-y-1">
				<h2 className="text-sm font-medium">Accuracy by week</h2>
				<p className="text-sm text-muted-foreground">
					Weeks with at least {MIN_ANSWERS_PER_WEEK} answers show up here. So
					far there are {weeks.length}.
				</p>
			</div>
		);
	}

	const points = pointsFor(weeks, CHART_WIDTH, CHART_HEIGHT, CHART_PADDING);
	const line = points
		.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
		.join(" ");
	const change = trendBetween(weeks) ?? 0;
	const last = weeks.at(-1);
	const first = weeks[0];

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 className="text-sm font-medium">Accuracy by week</h2>
				<p className="text-xs text-muted-foreground tabular-nums">
					{percent(first?.accuracy ?? 0)} → {percent(last?.accuracy ?? 0)}
					<span
						className={
							change >= 0 ? "ml-2 text-success" : "ml-2 text-destructive"
						}
					>
						{change >= 0 ? "+" : ""}
						{percent(change)}
					</span>
				</p>
			</div>
			<div className="overflow-x-auto">
				<svg
					viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
					className="h-36 w-full min-w-[320px]"
					role="img"
					aria-label={`Accuracy over ${weeks.length} weeks, from ${percent(
						first?.accuracy ?? 0,
					)} to ${percent(last?.accuracy ?? 0)}`}
				>
					<title>Accuracy by week</title>
					{[0.5, 0.75, 1].map((level) => (
						<line
							key={level}
							x1={CHART_PADDING}
							x2={CHART_WIDTH - CHART_PADDING}
							y1={
								CHART_PADDING + (1 - level) * (CHART_HEIGHT - CHART_PADDING * 2)
							}
							y2={
								CHART_PADDING + (1 - level) * (CHART_HEIGHT - CHART_PADDING * 2)
							}
							className="stroke-border"
							strokeWidth={1}
						/>
					))}
					<path
						d={line}
						fill="none"
						className="stroke-primary"
						strokeWidth={2}
						strokeLinejoin="round"
						strokeLinecap="round"
					/>
					{points.map((point, index) => (
						<circle
							key={weeks[index]?.weekStart}
							cx={point.x}
							cy={point.y}
							r={2.5}
							className="fill-primary"
						/>
					))}
				</svg>
			</div>
			<p className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
				<span>{shortDay(first?.weekStart ?? "")}</span>
				<span>
					{countedWeeks(weeks.length)} · {answers(last?.answered ?? 0)} in the
					last one
				</span>
				<span>{shortDay(last?.weekStart ?? "")}</span>
			</p>
		</div>
	);
}
