import { VocabularyDirection } from "@recall/contracts";

export const DIRECTION_LABELS: Readonly<Record<string, string>> = {
	[VocabularyDirection.TermToTranslation]: "термін → переклад",
	[VocabularyDirection.TranslationToTerm]: "переклад → термін",
};

export const NOTHING_YET =
	"Словника ще немає. Пара створює питання в обох напрямках, якщо обрати обидва.";
