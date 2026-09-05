import { describe, expect, test } from "bun:test";
import {
	emptyPair,
	joinAlternatives,
	type PairForm,
	pairProblems,
	splitAlternatives,
	toPair,
} from "@/features/authoring/ui/components/VocabularyList/VocabularyList.lib";

const pair = (over: Partial<PairForm> = {}): PairForm => ({
	...emptyPair(),
	term: "der Zug",
	translation: "потяг",
	...over,
});

describe("writing several alternatives on one line", () => {
	test("a comma separates them", () => {
		expect(splitAlternatives("потяг, поїзд")).toEqual(["потяг", "поїзд"]);
	});

	test("a semicolon does too, because people use both", () => {
		expect(splitAlternatives("потяг; поїзд")).toEqual(["потяг", "поїзд"]);
	});

	test("stray separators and spaces are dropped, not sent as blanks", () => {
		expect(splitAlternatives(" потяг ,, ; поїзд , ")).toEqual([
			"потяг",
			"поїзд",
		]);
	});

	test("nothing at all is no alternatives, not one empty one", () => {
		expect(splitAlternatives("   ")).toEqual([]);
		expect(splitAlternatives(",;,")).toEqual([]);
	});

	test("joining is the inverse a person can edit again", () => {
		expect(joinAlternatives(["потяг", "поїзд"])).toBe("потяг, поїзд");
	});
});

describe("what a half-written pair is refused for", () => {
	test("no term", () => {
		expect(pairProblems(pair({ term: " , " }))).toContain(
			"Потрібен щонайменше один термін",
		);
	});

	test("no translation", () => {
		expect(pairProblems(pair({ translation: "" }))).toContain(
			"Потрібен щонайменше один переклад",
		);
	});

	test("a complete pair has nothing to complain about", () => {
		expect(pairProblems(pair())).toEqual([]);
	});
});

describe("what a pair is sent as", () => {
	test("terms and translations go as lists", () => {
		expect(toPair(pair({ translation: "потяг, поїзд" }))).toEqual({
			term: ["der Zug"],
			translation: ["потяг", "поїзд"],
			transcription: undefined,
			example: undefined,
		});
	});

	test("an empty transcription is left out, not sent blank", () => {
		expect(toPair(pair({ transcription: "  " })).transcription).toBeUndefined();
		expect(toPair(pair({ transcription: "tsuːk" })).transcription).toBe(
			"tsuːk",
		);
	});
});
