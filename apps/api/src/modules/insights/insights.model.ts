import type { Insights as WireInsights } from "@recall/contracts";
import type { Insights } from "./use-cases";

export const insightsToWire = (insights: Insights): WireInsights => ({
	from: insights.from,
	to: insights.to,
	activity: insights.activity.map((day) => ({ ...day })),
	forecast: insights.forecast.map((day) => ({ ...day })),
	hardest: insights.hardest.map((stat) => ({
		questionId: String(stat.questionId),
		quizSetId: String(stat.quizSetId),
		quizSetTitle: stat.quizSetTitle,
		prompt: stat.prompt,
		answered: stat.answered,
		correct: stat.correct,
		lapses: stat.lapses,
	})),
	streak: insights.streak,
	answered: insights.answered,
	correct: insights.correct,
});
