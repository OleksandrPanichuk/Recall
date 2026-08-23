export const QuestionType = {
	SingleChoice: "single_choice",
	MultipleChoice: "multiple_choice",
	TrueFalse: "true_false",
	TypedAnswer: "typed_answer",
	Cloze: "cloze",
	Ordering: "ordering",
	Matching: "matching",
} as const;
export type QuestionType = (typeof QuestionType)[keyof typeof QuestionType];

export function isQuestionType(value: unknown): value is QuestionType {
	return (Object.values(QuestionType) as readonly unknown[]).includes(value);
}

export const Difficulty = {
	Easy: "easy",
	Medium: "medium",
	Hard: "hard",
} as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

export function isDifficulty(value: unknown): value is Difficulty {
	return (Object.values(Difficulty) as readonly unknown[]).includes(value);
}

export const CLOZE_BLANK = "___";
