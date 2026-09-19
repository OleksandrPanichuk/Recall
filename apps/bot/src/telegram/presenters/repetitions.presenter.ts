import type { DueSet, LeechView, RetiredView } from "@recall/contracts";
import { CallbackAction } from "../callbacks/callback-data.constants";
import type { Screen } from "./screen.types";
import { button } from "./utils/button";
import { truncated } from "./utils/truncate";

export const LISTED_QUESTIONS = 8;

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

type InlineRow = Screen["keyboard"][number];

const listButtons = (leeches: readonly LeechView[]): readonly InlineRow[] => [
	...(leeches.length === 0
		? []
		: [
				[
					button(`⚠️ Не даються (${leeches.length})`, {
						action: CallbackAction.Leeches,
					}),
				],
			]),
	[button("🗄 Відкладені", { action: CallbackAction.Retired })],
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
			keyboard: [
				...listButtons(leeches),
				[button("« Меню", { action: CallbackAction.Menu })],
			],
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
			...listButtons(leeches),
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}

export function leechesScreen(leeches: readonly LeechView[]): Screen {
	const listed = leeches.slice(0, LISTED_QUESTIONS);

	return {
		text:
			leeches.length === 0
				? "Нічого не застрягло — усі питання даються."
				: [
						`⚠️ Не даються: ${leeches.length}`,
						"",
						"Відкладене питання більше не з'являється в повтореннях, доки ви не повернете його.",
						"",
						...listed.map(
							(leech) =>
								`• ${leech.prompt} — ${leech.quizSetTitle}, забуто ${leech.lapses} р.`,
						),
						...(leeches.length > listed.length
							? ["", `Показано ${listed.length} з ${leeches.length}.`]
							: []),
					].join("\n"),
		keyboard: [
			...listed.map((leech) => [
				button(truncated(`🗄 ${leech.prompt}`), {
					action: CallbackAction.Retire,
					questionId: leech.questionId,
					retired: true,
				}),
			]),
			[button("🗄 Відкладені", { action: CallbackAction.Retired })],
			[button("« Повторення", { action: CallbackAction.Repetitions })],
		],
	};
}

export function retiredScreen(retired: readonly RetiredView[]): Screen {
	const listed = retired.slice(0, LISTED_QUESTIONS);

	return {
		text:
			retired.length === 0
				? "Нічого не відкладено. Питання, які не даються, можна відкласти зі списку «Не даються»."
				: [
						`🗄 Відкладені: ${retired.length}`,
						"",
						"Повернуте питання одразу стає до повторення.",
						"",
						...listed.map(
							(question) => `• ${question.prompt} — ${question.quizSetTitle}`,
						),
						...(retired.length > listed.length
							? ["", `Показано ${listed.length} з ${retired.length}.`]
							: []),
					].join("\n"),
		keyboard: [
			...listed.map((question) => [
				button(truncated(`↩️ ${question.prompt}`), {
					action: CallbackAction.Retire,
					questionId: question.questionId,
					retired: false,
				}),
			]),
			[button("« Повторення", { action: CallbackAction.Repetitions })],
		],
	};
}
