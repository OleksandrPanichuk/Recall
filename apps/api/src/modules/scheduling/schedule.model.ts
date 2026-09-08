import type {
	DueSet as WireDueSet,
	LeechView as WireLeech,
} from "@recall/contracts";
import type { DueSet } from "./schedule.entity.types";
import type { LeechView } from "./use-cases";

export const dueSetToWire = (due: DueSet): WireDueSet => ({
	quizSetId: String(due.quizSetId),
	title: due.title,
	dueCount: due.dueCount,
	overdueDays: due.overdueDays,
	dueQuestionIds: due.dueQuestionIds.map(String),
});

export const leechToWire = (leech: LeechView): WireLeech => ({
	questionId: String(leech.questionId),
	quizSetId: String(leech.quizSetId),
	quizSetTitle: leech.quizSetTitle,
	prompt: leech.prompt,
	lapses: leech.lapses,
});
