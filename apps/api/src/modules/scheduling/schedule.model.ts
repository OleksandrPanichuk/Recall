import type {
	DueSet as WireDueSet,
	LeechView as WireLeech,
	RetiredView as WireRetired,
	RetiredQuestion as WireRetiredQuestion,
} from "@recall/contracts";
import type { DueSet } from "./schedule.entity.types";
import type { LeechView, RetiredView, RetireQuestionResult } from "./use-cases";

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

export const retiredToWire = (retired: RetiredView): WireRetired => ({
	questionId: String(retired.questionId),
	quizSetId: String(retired.quizSetId),
	quizSetTitle: retired.quizSetTitle,
	prompt: retired.prompt,
	retiredAt: retired.retiredAt.toISOString(),
});

export const retiredQuestionToWire = (
	result: RetireQuestionResult,
): WireRetiredQuestion => ({
	questionId: String(result.questionId),
	retired: result.retired,
});
