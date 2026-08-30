function seedOf(source: string): number {
	let hash = 2166136261;

	for (let index = 0; index < source.length; index += 1) {
		hash ^= source.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return hash >>> 0;
}

export function shuffled<TItem>(
	items: readonly TItem[],
	seed: string,
): readonly TItem[] {
	const result = [...items];
	let state = seedOf(seed) || 1;

	for (let index = result.length - 1; index > 0; index -= 1) {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

		const target = state % (index + 1);
		const held = result[index] as TItem;

		result[index] = result[target] as TItem;
		result[target] = held;
	}

	return result;
}
