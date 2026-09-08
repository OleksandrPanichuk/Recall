import { type QuestionOptionId } from "@/modules/quizzes";

export type OptionPair = readonly [QuestionOptionId, QuestionOptionId];

export type Answer =
	| {
			readonly kind: "options";
			readonly optionIds: readonly QuestionOptionId[];
	  }
	| { readonly kind: "text"; readonly text: string }
	| { readonly kind: "order"; readonly optionIds: readonly QuestionOptionId[] }
	| { readonly kind: "pairs"; readonly pairs: readonly OptionPair[] };

export interface AnswerGrade {
	readonly earned: number;
	readonly possible: number;
}
