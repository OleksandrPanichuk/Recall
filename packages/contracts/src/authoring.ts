import { z } from "zod";
import { QuizSetStatus } from "./bot";
import { Difficulty, QuestionType, questionSchema } from "./questions";

export const MAX_OPTIONS_PER_QUESTION = 10;
export const MAX_QUESTIONS_PER_BATCH = 50;

export const AUTHORABLE_TYPES = [
	QuestionType.SingleChoice,
	QuestionType.MultipleChoice,
	QuestionType.TrueFalse,
	QuestionType.TypedAnswer,
	QuestionType.Cloze,
	QuestionType.Ordering,
	QuestionType.Matching,
] as const;

const answerText = z.string().trim().min(1).max(300);

const TYPED_TYPES: readonly QuestionType[] = [
	QuestionType.TypedAnswer,
	QuestionType.Cloze,
];

export const questionDraftOptionSchema = z.object({
	text: answerText,
	isCorrect: z.boolean(),
});

export const questionDraftSchema = z
	.object({
		type: z.enum(AUTHORABLE_TYPES),
		prompt: z.string().trim().min(1).max(1000),
		difficulty: z.enum(Difficulty),
		options: z
			.array(questionDraftOptionSchema)
			.min(2)
			.max(MAX_OPTIONS_PER_QUESTION)
			.optional(),
		pairs: z
			.array(z.object({ left: answerText, right: answerText }))
			.min(2)
			.max(MAX_OPTIONS_PER_QUESTION / 2)
			.optional(),
		orderedItems: z
			.array(answerText)
			.min(2)
			.max(MAX_OPTIONS_PER_QUESTION)
			.optional(),
		acceptedAnswers: z
			.array(answerText)
			.min(1)
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
					code: "custom",
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

export type QuestionDraft = z.infer<typeof questionDraftSchema>;

const id = z.string().trim().min(1).max(64);
const optionalId = id.optional();

export const createSetCommandSchema = z.object({
	title: z.string().trim().min(1).max(200),
	language: z.string().trim().min(2).max(20),
	description: z.string().trim().max(2000).optional(),
	source: z.string().trim().max(300).optional(),
	sourceChapters: z.string().trim().max(300).optional(),
	tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
	folderId: optionalId,
});

export const updateSetCommandSchema = createSetCommandSchema
	.omit({ folderId: true })
	.partial()
	.extend({ quizSetId: id });

export const moveSetCommandSchema = z.object({
	quizSetId: id,
	folderId: optionalId,
});

export const quizSetIdCommandSchema = z.object({ quizSetId: id });

export const addQuestionsCommandSchema = z.object({
	quizSetId: id,
	questions: z.array(questionDraftSchema).min(1).max(MAX_QUESTIONS_PER_BATCH),
});

export const updateQuestionCommandSchema = z.object({
	quizSetId: id,
	questionId: id,
	prompt: z.string().trim().min(1).max(1000).optional(),
	difficulty: z.enum(Difficulty).optional(),
	explanation: z.string().trim().max(1000).optional(),
	sourceReference: z.string().trim().max(300).optional(),
	topic: z.string().trim().max(100).optional(),
	hint: z.string().trim().max(300).optional(),
	options: z
		.array(questionDraftOptionSchema)
		.min(1)
		.max(MAX_OPTIONS_PER_QUESTION)
		.optional(),
	pairs: z
		.array(z.object({ left: answerText, right: answerText }))
		.min(2)
		.max(MAX_OPTIONS_PER_QUESTION / 2)
		.optional(),
	orderedItems: z
		.array(answerText)
		.min(2)
		.max(MAX_OPTIONS_PER_QUESTION)
		.optional(),
	acceptedAnswers: z
		.array(answerText)
		.min(1)
		.max(MAX_OPTIONS_PER_QUESTION)
		.optional(),
});

export const deleteQuestionCommandSchema = z.object({
	quizSetId: id,
	questionId: id,
});

export const listSetsCommandSchema = z.object({
	includeUnpublished: z.boolean().optional(),
});

export const createdSetSchema = z.object({ quizSetId: id });
export const addedQuestionsSchema = z.object({
	addedQuestionIds: z.array(id).readonly(),
	alreadyPresent: z.boolean(),
});
export const deletedQuestionSchema = z.object({
	questionId: id,
	remaining: z.number().int(),
});

export type CreateSetCommand = z.infer<typeof createSetCommandSchema>;
export type UpdateSetCommand = z.infer<typeof updateSetCommandSchema>;
export type QuizSetIdCommand = z.infer<typeof quizSetIdCommandSchema>;
export type AddQuestionsCommand = z.infer<typeof addQuestionsCommandSchema>;
export type UpdateQuestionCommand = z.infer<typeof updateQuestionCommandSchema>;
export type DeleteQuestionCommand = z.infer<typeof deleteQuestionCommandSchema>;
export type ListSetsCommand = z.infer<typeof listSetsCommandSchema>;
export type MoveSetCommand = z.infer<typeof moveSetCommandSchema>;

export const quizDetailSchema = z.object({
	id,
	title: z.string(),
	language: z.string(),
	status: z.enum(QuizSetStatus),
	description: z.string().optional(),
	source: z.string().optional(),
	sourceChapters: z.string().optional(),
	tags: z.array(z.string()).readonly(),
	folderId: optionalId,
	questions: z.array(questionSchema).readonly(),
	updatedAt: z.string(),
});

export type QuizDetail = z.infer<typeof quizDetailSchema>;
export type CreatedSet = z.infer<typeof createdSetSchema>;
export type AddedQuestions = z.infer<typeof addedQuestionsSchema>;
export type DeletedQuestion = z.infer<typeof deletedQuestionSchema>;
