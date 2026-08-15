export const hasDuplicates = (values: readonly string[]): boolean =>
	new Set(values).size !== values.length;
