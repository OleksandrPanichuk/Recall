import { z } from "zod";
import { Difficulty } from "@/domain/quiz-set/question";
import {
	MAX_OPTIONS_PER_QUESTION,
	questionOptionSchema,
} from "./question.schema";

const answerText = z.string().trim().min(1).max(300);
const id = z.string().trim().min(1).max(64);

export const updateQuestionShape = {
	quizSetId: id,
	questionId: id,
	prompt: z.string().trim().min(1).max(1000).optional(),
	difficulty: z
		.enum(Object.values(Difficulty) as [string, ...string[]])
		.optional(),
	explanation: z.string().trim().max(1000).optional(),
	sourceReference: z.string().trim().max(300).optional(),
	topic: z.string().trim().max(100).optional(),
	hint: z.string().trim().max(300).optional(),
	options: z
		.array(questionOptionSchema)
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
};

export const deleteQuestionShape = {
	quizSetId: id,
	questionId: id,
};
