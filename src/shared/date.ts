export const isValidDate = (value: Date): boolean =>
	!Number.isNaN(value.getTime());

export const copiedDate = (value: Date): Date => new Date(value.getTime());

export const copiedOptionalDate = (
	value: Date | undefined,
): Date | undefined => (value === undefined ? undefined : copiedDate(value));
