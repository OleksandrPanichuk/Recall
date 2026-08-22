export interface ListQuery {
	readonly start?: number;
	readonly end?: number;
	readonly sort?: string;
	readonly order: "ASC" | "DESC";
	readonly ids: readonly string[];
	readonly search?: string;
	readonly filters: Readonly<Record<string, string>>;
}

const RESERVED = new Set(["_sort", "_order", "_start", "_end", "_embed", "q"]);

const positive = (value: string | null): number | undefined => {
	if (value === null) {
		return undefined;
	}

	const parsed = Number(value);

	return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
};

export function listQueryOf(url: URL): ListQuery {
	const params = url.searchParams;
	const filters: Record<string, string> = {};

	for (const [key, value] of params.entries()) {
		if (RESERVED.has(key) || key === "id" || value.length === 0) {
			continue;
		}

		filters[key] = value;
	}

	const search = params.get("q")?.trim();
	const sort = params.get("_sort")?.trim();

	return {
		...(positive(params.get("_start")) === undefined
			? {}
			: { start: positive(params.get("_start")) }),
		...(positive(params.get("_end")) === undefined
			? {}
			: { end: positive(params.get("_end")) }),
		...(sort === undefined || sort.length === 0 ? {} : { sort }),
		order: params.get("_order")?.toUpperCase() === "DESC" ? "DESC" : "ASC",
		ids: params.getAll("id").filter((id) => id.length > 0),
		...(search === undefined || search.length === 0 ? {} : { search }),
		filters,
	};
}

export interface ListShape<TRow> {
	searchIn?(row: TRow): readonly (string | undefined)[];
	value(row: TRow, field: string): unknown;
}

export interface ListPage<TRow> {
	readonly rows: readonly TRow[];
	readonly total: number;
}

const comparable = (value: unknown): string | number => {
	if (typeof value === "number") {
		return value;
	}

	if (typeof value === "boolean") {
		return value ? 1 : 0;
	}

	if (value instanceof Date) {
		return value.getTime();
	}

	return value === undefined || value === null ? "" : String(value);
};

const matches = (value: unknown, wanted: string): boolean => {
	if (Array.isArray(value)) {
		return value.some((entry) => matches(entry, wanted));
	}

	return String(comparable(value)).toLowerCase() === wanted.toLowerCase();
};

export function listPage<TRow extends { readonly id: string }>(
	rows: readonly TRow[],
	query: ListQuery,
	shape: ListShape<TRow>,
): ListPage<TRow> {
	let selected = [...rows];

	if (query.ids.length > 0) {
		const wanted = new Set(query.ids);

		selected = selected.filter((row) => wanted.has(row.id));
	}

	for (const [field, wanted] of Object.entries(query.filters)) {
		selected = selected.filter((row) =>
			matches(shape.value(row, field), wanted),
		);
	}

	if (query.search !== undefined) {
		const needle = query.search.toLowerCase();

		selected = selected.filter((row) =>
			(shape.searchIn?.(row) ?? [])
				.filter((part): part is string => part !== undefined)
				.some((part) => part.toLowerCase().includes(needle)),
		);
	}

	if (query.sort !== undefined) {
		const field = query.sort;
		const direction = query.order === "DESC" ? -1 : 1;

		selected.sort((left, right) => {
			const a = comparable(shape.value(left, field));
			const b = comparable(shape.value(right, field));

			if (a === b) {
				return 0;
			}

			return (a < b ? -1 : 1) * direction;
		});
	}

	const total = selected.length;
	const start = query.start ?? 0;
	const end = query.end ?? total;

	return { rows: selected.slice(start, end), total };
}
