import { copiedDate } from "@/shared/utils/date";
import { trimmedOrUndefined } from "@/shared/utils/text";
import { brandedId } from "../branded-id";
import { VocabularyDirection } from "./vocabulary-item.constants";
import { VocabularyItemValidationError } from "./vocabulary-item.errors";
import type {
	VocabularyCard,
	VocabularyItem,
	VocabularyItemDraft,
	VocabularyItemId,
} from "./vocabulary-item.types";
import { collectVocabularyIssues } from "./vocabulary-item.validation";

export {
	isVocabularyDirection,
	MAX_VOCABULARY_TEXT,
	MAX_VOCABULARY_VARIANTS,
	VocabularyDirection,
} from "./vocabulary-item.constants";
export { VocabularyItemValidationError } from "./vocabulary-item.errors";
export type {
	VocabularyCard,
	VocabularyItem,
	VocabularyItemDraft,
	VocabularyItemId,
} from "./vocabulary-item.types";

export const toVocabularyItemId = (value: string): VocabularyItemId =>
	brandedId<"VocabularyItemId">(value, "VocabularyItemId");

const cleaned = (values: readonly string[]): readonly string[] =>
	values.map((value) => value.trim());

const frozenItem = (fields: VocabularyItem): VocabularyItem =>
	Object.freeze({
		...fields,
		terms: Object.freeze([...fields.terms]),
		translations: Object.freeze([...fields.translations]),
		createdAt: copiedDate(fields.createdAt),
		updatedAt: copiedDate(fields.updatedAt),
	});

export function createVocabularyItem(
	draft: VocabularyItemDraft,
): VocabularyItem {
	const terms = cleaned(draft.terms);
	const translations = cleaned(draft.translations);
	const issues = collectVocabularyIssues(terms, translations, draft.createdAt);

	if (issues.length > 0) {
		throw new VocabularyItemValidationError(issues);
	}

	return frozenItem({
		id: draft.id,
		quizSetId: draft.quizSetId,
		terms,
		translations,
		transcription: trimmedOrUndefined(draft.transcription),
		example: trimmedOrUndefined(draft.example),
		topic: trimmedOrUndefined(draft.topic),
		createdAt: draft.createdAt,
		updatedAt: draft.createdAt,
	});
}

export function restoreVocabularyItem(snapshot: {
	readonly id: VocabularyItemId;
	readonly quizSetId: VocabularyItem["quizSetId"];
	readonly terms: readonly string[];
	readonly translations: readonly string[];
	readonly transcription?: string;
	readonly example?: string;
	readonly topic?: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}): VocabularyItem {
	const terms = cleaned(snapshot.terms);
	const translations = cleaned(snapshot.translations);
	const issues = [
		...collectVocabularyIssues(terms, translations, snapshot.createdAt),
		...(snapshot.updatedAt.getTime() < snapshot.createdAt.getTime()
			? ["updatedAt must not precede createdAt"]
			: []),
	];

	if (issues.length > 0) {
		throw new VocabularyItemValidationError(issues);
	}

	return frozenItem({ ...snapshot, terms, translations });
}

const sameWord = (item: VocabularyItem): boolean =>
	item.terms[0]?.toLocaleLowerCase() ===
	item.translations[0]?.toLocaleLowerCase();

export function cardsOf(
	item: VocabularyItem,
	directions: readonly VocabularyDirection[],
): readonly VocabularyCard[] {
	const cards: VocabularyCard[] = [];

	for (const direction of new Set(directions)) {
		const asking = direction === VocabularyDirection.TermToTranslation;
		const prompt = asking ? item.terms[0] : item.translations[0];
		const accepted = asking ? item.translations : item.terms;

		if (prompt === undefined) {
			continue;
		}

		if (
			direction === VocabularyDirection.TranslationToTerm &&
			sameWord(item) &&
			cards.length > 0
		) {
			continue;
		}

		cards.push({
			direction,
			prompt,
			acceptedAnswers: accepted,
			hint: asking ? undefined : item.transcription,
		});
	}

	return cards;
}
