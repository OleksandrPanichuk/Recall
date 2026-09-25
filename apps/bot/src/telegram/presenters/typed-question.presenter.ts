import type { CurrentQuestionView, Question } from "@recall/contracts";
import { CallbackAction } from "../callbacks/callback-data.constants";
import type { Screen } from "./screen.types";
import { button } from "./utils/button";
import { heading, hintLine } from "./utils/question-heading";
import { shortenedTo, TELEGRAM_TEXT_LIMIT } from "./utils/text-limit";

const DIVIDER = "\n\n———\n\n";

export function typedQuestionScreen(
	view: CurrentQuestionView,
	question: Question,
): Screen {
	return {
		text: [
			heading(view),
			"",
			question.prompt,
			"",
			"✍️ Напишіть відповідь повідомленням.",
			hintLine(question.hint),
		]
			.filter((line) => line !== undefined)
			.join("\n"),
		keyboard: [
			[
				button("🤔 Не знаю", {
					action: CallbackAction.Reveal,
					questionId: question.id,
				}),
			],
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}

export function followedBy(feedback: Screen, next: Screen): Screen {
	const room = TELEGRAM_TEXT_LIMIT - DIVIDER.length - next.text.length;

	const kept = shortenedTo(feedback.text, room);

	return {
		text: kept.length === 0 ? next.text : `${kept}${DIVIDER}${next.text}`,
		keyboard: next.keyboard,
	};
}
