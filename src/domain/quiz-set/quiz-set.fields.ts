import { trimmedOrUndefined } from "@/shared/text";

export const normaliseTags = (
	tags: readonly string[] | undefined,
): string[] => [
	...new Set(
		(tags ?? [])
			.map((tag) => tag.trim())
			.filter((tag): tag is string => tag.length > 0),
	),
];

export const requiredField = (
	value: string | undefined,
	current: string,
	label: string,
	issues: string[],
): string => {
	if (value === undefined) {
		return current;
	}

	const trimmed = value.trim();

	if (trimmed.length === 0) {
		issues.push(`${label} must not be empty`);

		return current;
	}

	return trimmed;
};

export const optionalField = (
	value: string | undefined,
	current: string | undefined,
): string | undefined =>
	value === undefined ? current : trimmedOrUndefined(value);
