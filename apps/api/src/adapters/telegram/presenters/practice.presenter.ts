import type { PracticeMode } from "@/application/use-cases/practice/start-practice-session";
import {
	MIN_ANSWERS_FOR_TOPIC,
	WEAK_TOPIC_ACCURACY,
} from "@/domain/practice/practice.constants";
import { QuizAttemptMode } from "@/domain/quiz-attempt/quiz-attempt";
import { CallbackAction } from "../callbacks/callback-data.constants";
import type { Screen } from "./screen.types";
import { button } from "./utils/button";

const WEAK_PERCENT = Math.round(WEAK_TOPIC_ACCURACY * 100);

export function nothingToPractise(
	mode: PracticeMode,
	folderId?: string,
): Screen {
	return {
		text:
			mode === QuizAttemptMode.Mistakes
				? "Помилок немає — у цьому наборі немає питань, на які ви відповіли неправильно й досі не виправили."
				: `Слабких тем поки немає. Тема стає слабкою, коли на неї є щонайменше ${MIN_ANSWERS_FOR_TOPIC} відповіді й менше ніж ${WEAK_PERCENT}% з них правильні. Питання без теми сюди не потрапляють.`,
		keyboard: [
			[
				button("« До наборів", {
					action: CallbackAction.Browse,
					leaf:
						mode === QuizAttemptMode.Mistakes
							? CallbackAction.MistakesFor
							: CallbackAction.WeakTopicsFor,
					folderId,
				}),
			],
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}
