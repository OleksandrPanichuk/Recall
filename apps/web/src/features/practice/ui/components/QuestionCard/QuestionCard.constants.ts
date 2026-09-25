import { QuestionType } from "@recall/contracts";

export const QUESTION_HINT: Readonly<Record<string, string>> = {
	[QuestionType.MultipleChoice]: "Pick every correct option",
	[QuestionType.Ordering]: "Click them in the right order",
	[QuestionType.Matching]: "Make pairs: left first, then right",
	[QuestionType.TypedAnswer]: "Type your answer",
	[QuestionType.Cloze]: "Fill in the blank",
};
