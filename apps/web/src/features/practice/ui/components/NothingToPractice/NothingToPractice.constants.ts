import {
	MIN_ANSWERS_FOR_TOPIC,
	PracticeMode,
	WEAK_TOPIC_ACCURACY,
} from "@recall/contracts";
import type { PracticeSearchMode } from "@/features/practice/lib/practice-mode";

const WEAK_PERCENT = Math.round(WEAK_TOPIC_ACCURACY * 100);

export const NOTHING_TO_PRACTICE_TEXT: Readonly<
	Record<PracticeSearchMode, string>
> = {
	[PracticeMode.Mistakes]:
		"Nothing to retry — every question you got wrong has since been answered right.",
	[PracticeMode.WeakTopics]: `No weak topics yet. A topic counts as weak once it has at least ${MIN_ANSWERS_FOR_TOPIC} answers and fewer than ${WEAK_PERCENT}% of them are right. Questions without a topic never qualify.`,
};
