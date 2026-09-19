import {
	MIN_ANSWERS_FOR_TOPIC,
	PracticeMode,
	WEAK_TOPIC_ACCURACY,
} from "@recall/contracts";
import { CallbackAction } from "../callbacks/callback-data.constants";
import type { LeafAction } from "./browse.presenter";
import type { Screen } from "./screen.types";
import { button } from "./utils/button";

const WEAK_PERCENT = Math.round(WEAK_TOPIC_ACCURACY * 100);

const NOTHING_TEXT: Readonly<Record<PracticeMode, string>> = {
	[PracticeMode.Mistakes]:
		"Помилок немає — у цьому наборі немає питань, на які ви відповіли неправильно й досі не виправили.",
	[PracticeMode.WeakTopics]: `Слабких тем поки немає. Тема стає слабкою, коли на неї є щонайменше ${MIN_ANSWERS_FOR_TOPIC} відповіді й менше ніж ${WEAK_PERCENT}% з них правильні. Питання без теми сюди не потрапляють.`,
	[PracticeMode.Selected]: "У цьому наборі немає обраних питань для вправи.",
};

const BACK_LEAF: Readonly<Record<PracticeMode, LeafAction>> = {
	[PracticeMode.Mistakes]: CallbackAction.MistakesFor,
	[PracticeMode.WeakTopics]: CallbackAction.WeakTopicsFor,
	[PracticeMode.Selected]: CallbackAction.StartSet,
};

export function nothingToPractise(
	mode: PracticeMode,
	folderId?: string,
): Screen {
	return {
		text: NOTHING_TEXT[mode],
		keyboard: [
			[
				button("« До наборів", {
					action: CallbackAction.Browse,
					leaf: BACK_LEAF[mode],
					folderId,
				}),
			],
			[button("« Меню", { action: CallbackAction.Menu })],
		],
	};
}
