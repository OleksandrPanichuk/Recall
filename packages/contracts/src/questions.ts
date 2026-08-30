import { z } from "zod";

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

export const Difficulty = {
	Easy: "easy",
	Medium: "medium",
	Hard: "hard",
} as const;
export type Difficulty = (typeof Difficulty)[keyof typeof Difficulty];

export const CLOZE_BLANK = "___";

export const questionOptionSchema = z.object({
	id: z.string().min(1),
	text: z.string(),
	isCorrect: z.boolean(),
	position: z.number().int(),
	matchKey: z.string().optional(),
});

export const questionSchema = z.object({
	id: z.string().min(1),
	type: z.enum(QuestionType),
	prompt: z.string(),
	options: z.array(questionOptionSchema).readonly(),
	difficulty: z.enum(Difficulty),
	position: z.number().int(),
	explanation: z.string().optional(),
	sourceReference: z.string().optional(),
	topic: z.string().optional(),
	hint: z.string().optional(),
	vocabularyItemId: z.string().optional(),
});

export type QuestionOption = z.infer<typeof questionOptionSchema>;
export type Question = z.infer<typeof questionSchema>;

export interface MatchingSides {
	readonly left: readonly QuestionOption[];
	readonly right: readonly QuestionOption[];
}

export function expectsTypedAnswer(question: Question): boolean {
	return (
		question.type === QuestionType.TypedAnswer ||
		question.type === QuestionType.Cloze
	);
}

export function matchingSides(question: Question): MatchingSides {
	const ordered = question.options.toSorted(
		(left, right) => left.position - right.position,
	);
	const half = ordered.length / 2;

	return { left: ordered.slice(0, half), right: ordered.slice(half) };
}
