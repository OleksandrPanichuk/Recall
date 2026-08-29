import type { DailyActivity } from "@recall/contracts";
import { heatmapWeeks } from "@/lib/insights";

const WEEKDAYS = ["Пн", "", "Ср", "", "Пт", "", "Нд"];

const dayLabel = (day: string): string =>
	new Intl.DateTimeFormat("uk-UA", {
		day: "numeric",
		month: "long",
		timeZone: "UTC",
	}).format(new Date(`${day}T00:00:00.000Z`));

export interface ActivityHeatmapProps {
	readonly activity: readonly DailyActivity[];
	readonly today: Date;
}

export function ActivityHeatmap({ activity, today }: ActivityHeatmapProps) {
	const weeks = heatmapWeeks(activity, today);
	const upcoming = weeks
		.flat()
		.filter((cell) => cell.day > today.toISOString().slice(0, 10));

	return (
		<figure className="viz m-0 space-y-3">
			<figcaption className="text-sm font-medium">Відповіді за день</figcaption>
			<div className="flex gap-1.5">
				<div className="flex shrink-0 flex-col justify-between py-px">
					{WEEKDAYS.map((label, index) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: the seven weekday slots are fixed
							key={index}
							className="flex flex-1 items-center text-[10px] text-muted-foreground"
						>
							{label}
						</span>
					))}
				</div>
				<div className="flex min-w-0 flex-1 gap-[2px]">
					{weeks.map((week) => (
						<div
							key={week[0]?.day}
							className="flex min-w-0 flex-1 flex-col gap-[2px]"
						>
							{week.map((cell) => (
								<span
									key={cell.day}
									role="img"
									title={
										upcoming.includes(cell)
											? dayLabel(cell.day)
											: `${dayLabel(cell.day)}: ${cell.answered} відповідей, ${cell.correct} правильних`
									}
									aria-label={`${dayLabel(cell.day)}: ${cell.answered} відповідей`}
									className="aspect-square w-full rounded-[2px]"
									style={{
										background: `var(--viz-step-${cell.level})`,
										opacity: upcoming.includes(cell) ? 0.35 : 1,
									}}
								/>
							))}
						</div>
					))}
				</div>
			</div>
			<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
				менше
				{[0, 1, 2, 3, 4, 5].map((level) => (
					<span
						key={level}
						className="size-2.5 rounded-[2px]"
						style={{ background: `var(--viz-step-${level})` }}
					/>
				))}
				більше
			</div>
		</figure>
	);
}
