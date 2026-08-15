export const VocabularyDirection = {
	TermToTranslation: "term_to_translation",
	TranslationToTerm: "translation_to_term",
} as const;
export type VocabularyDirection =
	(typeof VocabularyDirection)[keyof typeof VocabularyDirection];

export function isVocabularyDirection(
	value: unknown,
): value is VocabularyDirection {
	return (Object.values(VocabularyDirection) as readonly unknown[]).includes(
		value,
	);
}

export const MAX_VOCABULARY_VARIANTS = 5;
export const MAX_VOCABULARY_TEXT = 300;
