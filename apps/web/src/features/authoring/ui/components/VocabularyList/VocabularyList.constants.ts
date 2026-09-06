import { VocabularyDirection } from "@recall/contracts";

export const DIRECTION_LABELS: Readonly<Record<string, string>> = {
	[VocabularyDirection.TermToTranslation]: "term → translation",
	[VocabularyDirection.TranslationToTerm]: "translation → term",
};

export const NOTHING_YET =
	"No vocabulary yet. A pair makes questions in both directions if you pick both.";
