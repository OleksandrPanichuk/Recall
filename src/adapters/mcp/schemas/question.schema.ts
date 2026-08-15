import { z } from "zod";
import { Difficulty, QuestionType } from "@/domain/quiz-set/question";

const values = <TValue extends string>(
	source: Readonly<Record<string, TValue>>,
): [TValue, ...TValue[]] => Object.values(source) as [TValue, ...TValue[]];

export const MAX_OPTIONS_PER_QUESTION = 10;

export const AUTHORABLE_TYPES = [
	QuestionType.TypedAnswer,
	QuestionType.Cloze,
	QuestionType.SingleChoice,
	QuestionType.MultipleChoice,
	QuestionType.TrueFalse,
] as const;

export const questionOptionSchema = z.object({
	text: z.string().trim().min(1).max(300),
	isCorrect: z.boolean(),
});

const answerText = z.string().trim().min(1).max(300);

const TYPED_TYPES: readonly QuestionType[] = [
	QuestionType.TypedAnswer,
	QuestionType.Cloze,
];

export const questionSchema = z
	.object({
		type: z.enum(AUTHORABLE_TYPES),
		prompt: z.string().trim().min(1).max(1000),
		difficulty: z.enum(values(Difficulty)),
		options: z
			.array(questionOptionSchema)
			.min(2)
			.max(MAX_OPTIONS_PER_QUESTION)
			.optional(),
		acceptedAnswers: z
			.array(answerText)
			.min(1)
			.max(MAX_OPTIONS_PER_QUESTION)
			.optional(),
		orderedItems: z
			.array(answerText)
			.min(2)
			.max(MAX_OPTIONS_PER_QUESTION)
			.optional(),
		pairs: z
			.array(z.object({ left: answerText, right: answerText }))
			.min(2)
			.max(MAX_OPTIONS_PER_QUESTION)
			.optional(),
		explanation: z.string().trim().max(1000).optional(),
		sourceReference: z.string().trim().max(300).optional(),
		topic: z.string().trim().max(100).optional(),
		hint: z.string().trim().max(300).optional(),
	})
	.superRefine((question, context) => {
		const require = (field: string, present: boolean): void => {
			if (!present) {
				context.addIssue({
					code: z.ZodIssueCode.custom,
					message: `${question.type} needs ${field}`,
					path: [field],
				});
			}
		};

		if (TYPED_TYPES.includes(question.type)) {
			require("acceptedAnswers", question.acceptedAnswers !== undefined);
		} else if (question.type === QuestionType.Ordering) {
			require("orderedItems", question.orderedItems !== undefined);
		} else if (question.type === QuestionType.Matching) {
			require("pairs", question.pairs !== undefined);
		} else {
			require("options", question.options !== undefined);
		}
	});

export type QuestionSchemaInput = z.infer<typeof questionSchema>;
