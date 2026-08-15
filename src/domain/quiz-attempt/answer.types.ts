import type { QuestionOptionId } from "../quiz-set/question";

export type OptionPair = readonly [QuestionOptionId, QuestionOptionId];

export type Answer =
	| {
			readonly kind: "options";
			readonly optionIds: readonly QuestionOptionId[];
	  }
	| { readonly kind: "text"; readonly text: string }
	| { readonly kind: "order"; readonly optionIds: readonly QuestionOptionId[] }
	| { readonly kind: "pairs"; readonly pairs: readonly OptionPair[] };

export const optionsAnswer = (
	optionIds: readonly QuestionOptionId[],
): Answer => ({ kind: "options", optionIds });

export const textAnswer = (text: string): Answer => ({ kind: "text", text });

export const orderAnswer = (
	optionIds: readonly QuestionOptionId[],
): Answer => ({ kind: "order", optionIds });

export const pairsAnswer = (pairs: readonly OptionPair[]): Answer => ({
	kind: "pairs",
	pairs,
});
