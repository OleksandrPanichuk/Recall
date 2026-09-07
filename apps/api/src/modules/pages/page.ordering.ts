import { FolderValidationError } from "./pages.errors";

export class PagePosition {
	private constructor() {}

	static readonly SCALE = 10;
	static readonly STEP = 1;

	private static readonly QUANTUM = 10 ** -PagePosition.SCALE;

	static round(value: number): number {
		return Number(value.toFixed(PagePosition.SCALE));
	}

	static canSitBetween(
		before: number | undefined,
		after: number | undefined,
	): boolean {
		if (before === undefined || after === undefined) {
			return true;
		}

		return after - before > 2 * PagePosition.QUANTUM;
	}

	static between(
		before: number | undefined,
		after: number | undefined,
	): number {
		if (before !== undefined && after !== undefined && before >= after) {
			throw new FolderValidationError([
				"the position before must be lower than the one after",
			]);
		}

		if (!PagePosition.canSitBetween(before, after)) {
			throw new FolderValidationError([
				"there is no room left between those two siblings",
			]);
		}

		if (before === undefined && after === undefined) {
			return PagePosition.STEP;
		}

		if (after === undefined) {
			return PagePosition.round((before as number) + PagePosition.STEP);
		}

		if (before === undefined) {
			return PagePosition.round(after - PagePosition.STEP);
		}

		return PagePosition.round((before + after) / 2);
	}

	static lastAmong(siblings: readonly { position: number }[]): number {
		return PagePosition.between(
			siblings.length === 0
				? undefined
				: Math.max(...siblings.map((sibling) => sibling.position)),
			undefined,
		);
	}

	static renumbered(count: number): readonly number[] {
		return Array.from(
			{ length: count },
			(_, index) => (index + 1) * PagePosition.STEP,
		);
	}
}
