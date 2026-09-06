import type { DueForecastDay } from "@recall/contracts";
import { forecastDays } from "@/features/statistics/lib/insights";
import { questions } from "@/shared/lib/plural";
import { SHOWN_DAYS } from "./DueForecast.constants";
import { fullDay, shortDay } from "./DueForecast.lib";

interface Props {
	readonly forecast: readonly DueForecastDay[];
	readonly today: Date;
}

export function DueForecast({ forecast, today }: Props) {
	const days = forecastDays(forecast, today, SHOWN_DAYS);
	const busiest = days.reduce((most, day) => Math.max(most, day.due), 0);

	if (busiest === 0) {
		return (
			<figure className="viz m-0 space-y-3">
				<figcaption className="text-sm font-medium">
					Coming up over two weeks
				</figcaption>
				<p className="text-sm text-muted-foreground">
					Nothing comes back in the next two weeks.
				</p>
			</figure>
		);
	}

	return (
		<figure className="viz m-0 space-y-3">
			<figcaption className="text-sm font-medium">
				Coming up over two weeks
			</figcaption>
			<div className="flex h-32 items-end gap-[2px]">
				{days.map((day) => (
					<div
						key={day.day}
						className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
						title={`${fullDay(day.day)}: ${questions(day.due)}`}
					>
						{day.due === 0 ? null : (
							<span className="text-[10px] leading-none text-muted-foreground">
								{day.due}
							</span>
						)}
						<span
							role="img"
							aria-label={`${fullDay(day.day)}: ${questions(day.due)}`}
							className="w-full max-w-6 rounded-t"
							style={{
								height: `${Math.max(2, (day.due / busiest) * 100)}%`,
								background:
									day.due === 0 ? "var(--viz-step-0)" : "var(--viz-series)",
							}}
						/>
						<span className="text-[10px] leading-none text-muted-foreground">
							{shortDay(day.day)}
						</span>
					</div>
				))}
			</div>
		</figure>
	);
}
