import type { DueSet } from "@/application/use-cases/repetition/list-due-repetitions";
import type { LeechView } from "@/application/use-cases/repetition/list-leeches";
import { CallbackAction } from "../callbacks/callback-data.constants";
import type { Screen } from "./screen.types";
import { button } from "./utils/button";
import { truncated } from "./utils/truncate";

export const overdueLabel = (overdueDays: number): string => {
	if (overdueDays === 0) {
		return "сьогодні";
	}

	if (overdueDays === 1) {
		return "вчора";
	}

	return `${overdueDays} дн. тому`;
};

const leechLines = (leeches: readonly LeechView[]): readonly string[] =>
	leeches.length === 0
		? []
		: [
				"",
				`⚠️ Не даються (${leeches.length}) — варто переписати картку:`,
				...leeches
					.slice(0, 5)
					.map((leech) => `• ${leech.prompt} — забуто ${leech.lapses} р.`),
			];

export function repetitionsScreen(
	due: readonly DueSet[],
	leeches: readonly LeechView[] = [],
): Screen {
	if (due.length === 0) {
		return {
			text: [
				"Нічого повторювати — усе за розкладом. Загляньте пізніше.",
				...leechLines(leeches),
			].join("\n"),
			keyboard: [[button("« Меню", { action: CallbackAction.Menu })]],
		};
	}

	return {
		text: [
			`🔁 На повторення: ${due.length}`,
			"",
			...due.map(
				(entry) =>
					`• ${entry.title} — ${entry.dueCount} сл., ${overdueLabel(entry.overdueDays)}`,
			),
			...leechLines(leeches),
		].join("\n"),
		keyboard: [
			...due.map((entry) => [
				button(truncated(`🔁 ${entry.title} (${entry.dueCount})`), {
					action: CallbackAction.StartDue,
					quizSetId: entry.quizSetId,
				}),
			]),
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}
