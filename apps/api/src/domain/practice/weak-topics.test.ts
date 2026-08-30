import { describe, expect, test } from "bun:test";
import { type TopicScore, weakTopicsOf } from "./weak-topics";

const score = (
	topic: string | undefined,
	answered: number,
	correct: number,
): TopicScore => ({ topic, answered, correct });

const topicsOf = (scores: readonly TopicScore[]): readonly string[] =>
	weakTopicsOf(scores).map((weak) => weak.topic);

describe("weakTopicsOf", () => {
	test("keeps a topic answered enough times and mostly wrong", () => {
		expect(topicsOf([score("Alpha", 4, 1)])).toEqual(["Alpha"]);
	});

	test("drops a topic without enough answers to judge", () => {
		expect(topicsOf([score("Alpha", 2, 0)])).toEqual([]);
	});

	test("counts the third answer as enough", () => {
		expect(topicsOf([score("Alpha", 3, 0)])).toEqual(["Alpha"]);
	});

	test("drops a topic that is exactly at the threshold", () => {
		expect(topicsOf([score("Alpha", 10, 7)])).toEqual([]);
	});

	test("keeps a topic just under the threshold", () => {
		expect(topicsOf([score("Alpha", 10, 6)])).toEqual(["Alpha"]);
	});

	test("leaves untagged questions out, however weak", () => {
		expect(topicsOf([score(undefined, 40, 0)])).toEqual([]);
	});

	test("puts the weakest topic first", () => {
		expect(
			topicsOf([
				score("Mid", 10, 5),
				score("Worst", 10, 1),
				score("Ok", 10, 6),
			]),
		).toEqual(["Worst", "Mid", "Ok"]);
	});

	test("breaks a tie on accuracy by the topic answered more often", () => {
		expect(topicsOf([score("Few", 4, 1), score("Many", 8, 2)])).toEqual([
			"Many",
			"Few",
		]);
	});

	test("breaks a full tie by topic name", () => {
		expect(topicsOf([score("Beta", 4, 1), score("Alpha", 4, 1)])).toEqual([
			"Alpha",
			"Beta",
		]);
	});

	test("reports nothing when every topic is strong", () => {
		expect(topicsOf([score("Alpha", 10, 9), score("Beta", 10, 10)])).toEqual(
			[],
		);
	});

	test("reports nothing for no history at all", () => {
		expect(weakTopicsOf([])).toEqual([]);
	});

	test("carries the counts through for the screen to show", () => {
		expect(weakTopicsOf([score("Alpha", 4, 1)])).toEqual([
			{ topic: "Alpha", answered: 4, correct: 1 },
		]);
	});
});
