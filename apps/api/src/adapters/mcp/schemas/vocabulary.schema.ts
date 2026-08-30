import { z } from "zod";
import { Difficulty } from "@/domain/quiz-set/question";
import {
	MAX_VOCABULARY_TEXT,
	MAX_VOCABULARY_VARIANTS,
	VocabularyDirection,
} from "@/domain/vocabulary/vocabulary-item";

const word = z.string().trim().min(1).max(MAX_VOCABULARY_TEXT);

const side = z.union([word, z.array(word).min(1).max(MAX_VOCABULARY_VARIANTS)]);

export const MAX_VOCABULARY_PAIRS = 100;

export const addVocabularyShape = {
	quizSetId: z.string().trim().min(1).max(64),
	pairs: z
		.array(
			z.object({
				term: side,
				translation: side,
				transcription: z.string().trim().max(100).optional(),
				example: z.string().trim().max(500).optional(),
			}),
		)
		.min(1)
		.max(MAX_VOCABULARY_PAIRS),
	direction: z
		.enum([
			"both",
			VocabularyDirection.TermToTranslation,
			VocabularyDirection.TranslationToTerm,
		])
		.optional(),
	topic: z.string().trim().max(100).optional(),
	difficulty: z
		.enum(Object.values(Difficulty) as [string, ...string[]])
		.optional(),
};

export const listVocabularyShape = {
	quizSetId: z.string().trim().min(1).max(64),
};

export const updateVocabularyShape = {
	itemId: z.string().trim().min(1).max(64),
	term: side.optional(),
	translation: side.optional(),
	transcription: z.string().trim().max(100).optional(),
	example: z.string().trim().max(500).optional(),
};
