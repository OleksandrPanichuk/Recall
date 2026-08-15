export type CorruptedRowErrorFactory = (
	id: string,
	issues: readonly string[],
) => Error;

export interface RowValueParsers {
	readonly requiredDate: (value: string, column: string, id: string) => Date;
	readonly optionalDate: (
		value: string | null,
		column: string,
		id: string,
	) => Date | undefined;
	readonly parseStringArray: (
		value: string,
		column: string,
		id: string,
	) => string[];
}

export function createRowValueParsers(
	corrupted: CorruptedRowErrorFactory,
): RowValueParsers {
	const requiredDate = (value: string, column: string, id: string): Date => {
		const date = new Date(value);

		if (Number.isNaN(date.getTime())) {
			throw corrupted(id, [`${column} must be a valid ISO timestamp`]);
		}

		return date;
	};

	const optionalDate = (
		value: string | null,
		column: string,
		id: string,
	): Date | undefined =>
		value === null ? undefined : requiredDate(value, column, id);

	const parseStringArray = (
		value: string,
		column: string,
		id: string,
	): string[] => {
		let parsed: unknown;

		try {
			parsed = JSON.parse(value);
		} catch {
			throw corrupted(id, [`${column} must be a JSON array`]);
		}

		if (
			!Array.isArray(parsed) ||
			!parsed.every((entry): entry is string => typeof entry === "string")
		) {
			throw corrupted(id, [`${column} must be a JSON array of strings`]);
		}

		return parsed;
	};

	return { requiredDate, optionalDate, parseStringArray };
}
