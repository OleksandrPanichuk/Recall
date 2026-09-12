import { MIN_ANSWERS_FOR_TOPIC, WEAK_TOPIC_ACCURACY } from "@recall/contracts";

export interface TopicScore {
	readonly topic: string | undefined;
	readonly answered: number;
	readonly correct: number;
}

export interface WeakTopicEntity {
	readonly topic: string;
	readonly answered: number;
	readonly correct: number;
}

const accuracyOf = (weak: WeakTopicEntity): number =>
	weak.correct / weak.answered;

const named = (score: TopicScore): WeakTopicEntity | undefined =>
	score.topic === undefined
		? undefined
		: {
				topic: score.topic,
				answered: score.answered,
				correct: score.correct,
			};

export class WeakTopicEntity {
	private constructor() {}

	static from(scores: readonly TopicScore[]): readonly WeakTopicEntity[] {
		return scores
			.map(named)
			.filter((weak): weak is WeakTopicEntity => weak !== undefined)
			.filter(
				(weak) =>
					weak.answered >= MIN_ANSWERS_FOR_TOPIC &&
					accuracyOf(weak) < WEAK_TOPIC_ACCURACY,
			)
			.toSorted(
				(left, right) =>
					accuracyOf(left) - accuracyOf(right) ||
					right.answered - left.answered ||
					left.topic.localeCompare(right.topic),
			);
	}
}
