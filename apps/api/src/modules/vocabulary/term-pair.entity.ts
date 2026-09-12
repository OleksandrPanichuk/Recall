import { trimmedOrUndefined } from "@recall/kit";
import { brandedId } from "@/core/branded-id";
import type { QuizSetId } from "@/modules/quizzes";
import { copiedDate } from "@/shared/utils/date";
import { VocabularyDirection } from "./term-pair.constants";
import type {
	VocabularyCard,
	VocabularyItemDraft,
	VocabularyItemId,
} from "./term-pair.entity.types";
import { collectVocabularyIssues } from "./term-pair.entity.validation";
import { VocabularyItemValidationError } from "./vocabulary.errors";

export {
	isVocabularyDirection,
	MAX_VOCABULARY_TEXT,
	MAX_VOCABULARY_VARIANTS,
	VocabularyDirection,
} from "./term-pair.constants";
export type {
	VocabularyCard,
	VocabularyItemDraft,
	VocabularyItemId,
} from "./term-pair.entity.types";
export { VocabularyItemValidationError } from "./vocabulary.errors";

export const toVocabularyItemId = (value: string): VocabularyItemId =>
	brandedId<"VocabularyItemId">(value, "VocabularyItemId");

const cleaned = (values: readonly string[]): readonly string[] =>
	values.map((value) => value.trim());

const frozenItem = (fields: TermPairEntity): TermPairEntity =>
	Object.freeze({
		...fields,
		terms: Object.freeze([...fields.terms]),
		translations: Object.freeze([...fields.translations]),
		createdAt: copiedDate(fields.createdAt),
		updatedAt: copiedDate(fields.updatedAt),
	});

const sameWord = (item: TermPairEntity): boolean =>
	item.terms[0]?.toLocaleLowerCase() ===
	item.translations[0]?.toLocaleLowerCase();

export interface TermPairEntity {
	readonly id: VocabularyItemId;
	readonly quizSetId: QuizSetId;
	readonly terms: readonly string[];
	readonly translations: readonly string[];
	readonly transcription?: string;
	readonly example?: string;
	readonly topic?: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

export class TermPairEntity {
	private constructor() {}

	static create(draft: VocabularyItemDraft): TermPairEntity {
		const terms = cleaned(draft.terms);
		const translations = cleaned(draft.translations);
		const issues = collectVocabularyIssues(
			terms,
			translations,
			draft.createdAt,
		);

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

	static restore(snapshot: {
		readonly id: VocabularyItemId;
		readonly quizSetId: TermPairEntity["quizSetId"];
		readonly terms: readonly string[];
		readonly translations: readonly string[];
		readonly transcription?: string;
		readonly example?: string;
		readonly topic?: string;
		readonly createdAt: Date;
		readonly updatedAt: Date;
	}): TermPairEntity {
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

	static cards(
		item: TermPairEntity,
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
}
