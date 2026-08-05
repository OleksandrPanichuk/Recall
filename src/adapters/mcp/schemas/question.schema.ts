import { z } from "zod";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";

const values = <TValue extends string>(
	source: Readonly<Record<string, TValue>>,
): [TValue, ...TValue[]] => Object.values(source) as [TValue, ...TValue[]];

/** Upper bound on options per question; the domain requires at least two. */
export const MAX_OPTIONS_PER_QUESTION = 10;

export const questionOptionSchema = z.object({
	text: z.string().trim().min(1).max(300),
	isCorrect: z.boolean(),
});

export const questionSchema = z.object({
	type: z.enum(values(QuestionType)),
	prompt: z.string().trim().min(1).max(1000),
	difficulty: z.enum(values(Difficulty)),
	options: z.array(questionOptionSchema).min(2).max(MAX_OPTIONS_PER_QUESTION),
	explanation: z.string().trim().max(1000).optional(),
	sourceReference: z.string().trim().max(300).optional(),
	topic: z.string().trim().max(100).optional(),
	hint: z.string().trim().max(300).optional(),
});

export type QuestionSchemaInput = z.infer<typeof questionSchema>;
