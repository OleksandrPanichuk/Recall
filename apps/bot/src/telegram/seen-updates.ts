import { REMEMBERED_UPDATES } from "./webhook.constants";

export interface SeenUpdates {
	firstSighting(updateId: number): boolean;
	readonly size: number;
}

export function createSeenUpdates(capacity = REMEMBERED_UPDATES): SeenUpdates {
	const seen = new Set<number>();

	return {
		firstSighting(updateId: number): boolean {
			if (seen.has(updateId)) {
				return false;
			}

			seen.add(updateId);

			if (seen.size > capacity) {
				const oldest = seen.values().next();

				if (!oldest.done) {
					seen.delete(oldest.value);
				}
			}

			return true;
		},

		get size(): number {
			return seen.size;
		},
	};
}
