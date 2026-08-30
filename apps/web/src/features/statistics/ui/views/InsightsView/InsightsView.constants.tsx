import type { Insights } from "@recall/contracts";
import { Flame, ListChecks, Target } from "lucide-react";
import type { Stat } from "@/features/statistics/lib/tiles.types";

export const insightTiles = (insights: Insights): readonly Stat[] => [
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
		value:
			insights.answered === 0
				? "—"
				: `${Math.round((insights.correct / insights.answered) * 100)}%`,
		hint:
			insights.answered === 0 ? undefined : `${insights.correct} правильних`,
		icon: <Target className="size-3.5" />,
	},
];
