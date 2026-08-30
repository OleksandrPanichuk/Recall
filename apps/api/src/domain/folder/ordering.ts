import { FolderValidationError } from "./folder.errors";

export const POSITION_SCALE = 10;
export const POSITION_STEP = 1;

const quantum = 10 ** -POSITION_SCALE;

export const roundPosition = (value: number): number =>
	Number(value.toFixed(POSITION_SCALE));

export function canSitBetween(
	before: number | undefined,
	after: number | undefined,
): boolean {
	if (before === undefined || after === undefined) {
		return true;
	}

	return after - before > 2 * quantum;
}

export function positionBetween(
	before: number | undefined,
	after: number | undefined,
): number {
	if (before !== undefined && after !== undefined && before >= after) {
		throw new FolderValidationError([
			"the position before must be lower than the one after",
		]);
	}

	if (!canSitBetween(before, after)) {
		throw new FolderValidationError([
			"there is no room left between those two siblings",
		]);
	}

	if (before === undefined && after === undefined) {
		return POSITION_STEP;
	}

	if (after === undefined) {
		return roundPosition((before as number) + POSITION_STEP);
	}

	if (before === undefined) {
		return roundPosition(after - POSITION_STEP);
	}

	return roundPosition((before + after) / 2);
}

export const renumbered = (count: number): readonly number[] =>
	Array.from({ length: count }, (_, index) => (index + 1) * POSITION_STEP);
