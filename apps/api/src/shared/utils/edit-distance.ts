export function editDistance(left: string, right: string): number {
	if (left === right) {
		return 0;
	}

	let twoBack: number[] = [];
	let previous = Array.from(
		{ length: right.length + 1 },
		(_value, index) => index,
	);

	for (let row = 1; row <= left.length; row += 1) {
		const current = [row];

		for (let column = 1; column <= right.length; column += 1) {
			const substitution =
				(previous[column - 1] ?? 0) +
				(left[row - 1] === right[column - 1] ? 0 : 1);
			const best = Math.min(
				substitution,
				(previous[column] ?? 0) + 1,
				(current[column - 1] ?? 0) + 1,
			);
			const transposed =
				row > 1 &&
				column > 1 &&
				left[row - 1] === right[column - 2] &&
				left[row - 2] === right[column - 1];

			current[column] = transposed
				? Math.min(best, (twoBack[column - 2] ?? 0) + 1)
				: best;
		}

		twoBack = previous;
		previous = current;
	}

	return previous[right.length] ?? 0;
}

export function isWithinOneEdit(candidate: string, target: string): boolean {
	return editDistance(candidate, target) === 1;
}
