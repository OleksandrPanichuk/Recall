import type { Insights } from "@recall/contracts";
import { Flame, ListChecks, Target } from "lucide-react";
import type { Stat } from "@/features/statistics/lib/tiles.types";

export const insightTiles = (insights: Insights): readonly Stat[] => [
	{
		label: "Streak",
		value: `${insights.streak}`,
		hint: insights.streak === 0 ? "start today" : "days running",
		icon: <Flame className="size-3.5" />,
	},
	{
		label: "Answers",
		value: `${insights.answered}`,
		icon: <ListChecks className="size-3.5" />,
	},
	{
		label: "Accuracy",
		value:
			insights.answered === 0
				? "—"
				: `${Math.round((insights.correct / insights.answered) * 100)}%`,
		hint: insights.answered === 0 ? undefined : `${insights.correct} correct`,
		icon: <Target className="size-3.5" />,
	},
];
