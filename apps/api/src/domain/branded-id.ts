import { InvalidIdentifierError } from "./quiz-set/quiz-set.errors";

declare const idBrand: unique symbol;

export type BrandedId<TBrand extends string> = string & {
	readonly [idBrand]: TBrand;
};

export function brandedId<TBrand extends string>(
	value: string,
	label: string,
): BrandedId<TBrand> {
	const trimmed = value.trim();

	if (trimmed.length === 0) {
		throw new InvalidIdentifierError(label);
	}

	return trimmed as BrandedId<TBrand>;
}
