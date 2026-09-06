import { QuestionType } from "@recall/contracts";

export const TYPE_LABELS: Readonly<Record<string, string>> = {
	[QuestionType.SingleChoice]: "One answer",
	[QuestionType.MultipleChoice]: "Several answers",
	[QuestionType.TrueFalse]: "True or false",
	[QuestionType.TypedAnswer]: "Type the answer",
	[QuestionType.Cloze]: "Fill in the blank",
	[QuestionType.Ordering]: "Put in order",
	[QuestionType.Matching]: "Match pairs",
};

export const DIFFICULTY_LABELS: Readonly<Record<string, string>> = {
	easy: "Easy",
	medium: "Medium",
	hard: "Hard",
};

export const STATUS_LABELS: Readonly<Record<string, string>> = {
	draft: "Draft",
	published: "Published",
	archived: "Archived",
};

export const ANSWER_SHAPE: Readonly<
	Record<string, "options" | "accepted" | "ordered" | "pairs">
> = {
	[QuestionType.SingleChoice]: "options",
	[QuestionType.MultipleChoice]: "options",
	[QuestionType.TrueFalse]: "options",
	[QuestionType.TypedAnswer]: "accepted",
	[QuestionType.Cloze]: "accepted",
	[QuestionType.Ordering]: "ordered",
	[QuestionType.Matching]: "pairs",
};
