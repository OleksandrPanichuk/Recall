const PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: unknown): value is string =>
	typeof value === "string" && PATTERN.test(value);

export const uuidsIn = (values: readonly unknown[]): readonly string[] =>
	values.map(String).filter(isUuid);
