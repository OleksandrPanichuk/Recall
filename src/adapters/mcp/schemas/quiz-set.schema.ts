import { z } from "zod";
import { MAX_QUESTIONS_PER_BATCH } from "@/application/use-cases/quiz-sets/add-questions";
import { questionSchema } from "./question.schema";

const quizSetId = z.string().trim().min(1).max(64);

export const createSetShape = {
	title: z.string().trim().min(1).max(200),
	language: z.string().trim().min(1).max(20),
	description: z.string().trim().max(1000).optional(),
	source: z.string().trim().max(300).optional(),
	sourceChapters: z.string().trim().max(300).optional(),
	tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
};

export const updateSetShape = {
	quizSetId,
	title: z.string().trim().max(200).optional(),
	language: z.string().trim().max(20).optional(),
	description: z.string().trim().max(1000).optional(),
	source: z.string().trim().max(300).optional(),
	sourceChapters: z.string().trim().max(300).optional(),
	tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
};

export const addQuestionsShape = {
	quizSetId,
	questions: z.array(questionSchema).min(1).max(MAX_QUESTIONS_PER_BATCH),
};

export const quizSetIdShape = { quizSetId };

export const listSetsShape = {
	includeUnpublished: z.boolean().optional(),
};
