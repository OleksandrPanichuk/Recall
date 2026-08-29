import type { Clock } from "@/application/ports/clock";
import type {
	DailyActivity,
	DueForecastDay,
	QuestionStat,
} from "@/application/ports/repositories/analytics.repository";
import type { RepositoryScope } from "@/application/ports/repositories/page.repository";
import type {
	ApplicationDependencies,
	Command,
	UseCase,
} from "@/application/use-case";

export const DEFAULT_HISTORY_DAYS = 371;
export const DEFAULT_FORECAST_DAYS = 14;
export const HARDEST_QUESTIONS = 10;
export const MINIMUM_ANSWERS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GetInsightsCommand {
	readonly historyDays?: number;
	readonly forecastDays?: number;
}

export interface Insights {
	readonly from: string;
	readonly to: string;
	readonly activity: readonly DailyActivity[];
	readonly forecast: readonly DueForecastDay[];
	readonly hardest: readonly QuestionStat[];
	readonly streak: number;
	readonly answered: number;
	readonly correct: number;
}

export type GetInsightsDependencies = ApplicationDependencies;

const midnightAfter = (at: Date): Date =>
	new Date(Math.floor(at.getTime() / DAY_MS) * DAY_MS + DAY_MS);

export const streakOf = (
	activity: readonly DailyActivity[],
	today: string,
	yesterday: string,
): number => {
	const days = new Set(
		activity.filter((day) => day.answered > 0).map((day) => day.day),
	);

	if (!days.has(today) && !days.has(yesterday)) {
		return 0;
	}

	let streak = 0;
	let cursor = new Date(`${days.has(today) ? today : yesterday}T00:00:00.000Z`);

	while (days.has(cursor.toISOString().slice(0, 10))) {
		streak += 1;
		cursor = new Date(cursor.getTime() - DAY_MS);
	}

	return streak;
};

export class GetInsightsUseCase
	implements UseCase<Command<GetInsightsCommand>, Insights>
{
	private readonly scope: RepositoryScope;
	private readonly clock: Clock;
	private readonly timezone: string;

	constructor(dependencies: GetInsightsDependencies) {
		this.scope = dependencies.scope;
		this.clock = dependencies.clock;
		this.timezone = dependencies.timezone;
	}

	async execute(request: Command<GetInsightsCommand>): Promise<Insights> {
		const { analytics } = this.scope;
		const now = this.clock.now();
		const historyDays = request.historyDays ?? DEFAULT_HISTORY_DAYS;
		const forecastDays = request.forecastDays ?? DEFAULT_FORECAST_DAYS;
		const endOfToday = midnightAfter(now);
		const timezone = this.timezone;

		const activity = await analytics.dailyActivity({
			from: new Date(endOfToday.getTime() - historyDays * DAY_MS),
			to: endOfToday,
			timezone,
		});
		const forecast = await analytics.dueForecast({
			from: new Date(endOfToday.getTime() - DAY_MS),
			to: new Date(endOfToday.getTime() + forecastDays * DAY_MS),
			timezone,
		});
		const hardest = await analytics.hardestQuestions(
			HARDEST_QUESTIONS,
			MINIMUM_ANSWERS,
		);

		const day = (at: Date): string =>
			new Intl.DateTimeFormat("en-CA", {
				timeZone: timezone,
				year: "numeric",
				month: "2-digit",
				day: "2-digit",
			}).format(at);

		return {
			from: day(new Date(endOfToday.getTime() - historyDays * DAY_MS)),
			to: day(now),
			activity,
			forecast,
			hardest,
			streak: streakOf(
				activity,
				day(now),
				day(new Date(now.getTime() - DAY_MS)),
			),
			answered: activity.reduce((total, entry) => total + entry.answered, 0),
			correct: activity.reduce((total, entry) => total + entry.correct, 0),
		};
	}
}
