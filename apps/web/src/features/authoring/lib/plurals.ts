export function questionCount(count: number): string {
	const tail = count % 10;
	const teens = count % 100;

	if (tail === 1 && teens !== 11) {
		return `${count} питання`;
	}

	if (tail >= 2 && tail <= 4 && (teens < 12 || teens > 14)) {
		return `${count} питання`;
	}

	return `${count} питань`;
}
