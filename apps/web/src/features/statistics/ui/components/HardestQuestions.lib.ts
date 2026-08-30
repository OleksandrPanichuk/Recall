import type { QuestionStat } from "@recall/contracts";

export const percentage = (stat: QuestionStat): number =>
	Math.round((stat.correct / stat.answered) * 100);
