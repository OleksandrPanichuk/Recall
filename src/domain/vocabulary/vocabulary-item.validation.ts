import { isValidDate } from "@/shared/utils/date";
import {
	MAX_VOCABULARY_TEXT,
	MAX_VOCABULARY_VARIANTS,
} from "./vocabulary-item.constants";

const collectSideIssues = (
	values: readonly string[],
	label: string,
): readonly string[] => {
	const issues: string[] = [];

	if (values.length === 0) {
		issues.push(`${label} must not be empty`);
	}

	if (values.length > MAX_VOCABULARY_VARIANTS) {
		issues.push(`${label} must not exceed ${MAX_VOCABULARY_VARIANTS} variants`);
	}

	if (values.some((value) => value.length === 0)) {
		issues.push(`${label} must not contain empty values`);
	}

	if (values.some((value) => value.length > MAX_VOCABULARY_TEXT)) {
		issues.push(
			`${label} must not exceed ${MAX_VOCABULARY_TEXT} characters per value`,
		);
	}

	if (
		new Set(values.map((value) => value.toLocaleLowerCase())).size !==
		values.length
	) {
		issues.push(`${label} must not repeat a value`);
	}

	return issues;
};

export const collectVocabularyIssues = (
	terms: readonly string[],
	translations: readonly string[],
	createdAt: Date,
): readonly string[] => [
	...collectSideIssues(terms, "terms"),
	...collectSideIssues(translations, "translations"),
	...(isValidDate(createdAt) ? [] : ["createdAt must be a valid date"]),
];
