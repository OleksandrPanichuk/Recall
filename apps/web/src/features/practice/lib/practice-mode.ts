import { PracticeMode } from "@recall/contracts";

export const PRACTICE_SEARCH_MODES = [
	PracticeMode.Mistakes,
	PracticeMode.WeakTopics,
] as const;

export type PracticeSearchMode = (typeof PRACTICE_SEARCH_MODES)[number];

export interface PracticeSearch {
	readonly mode?: PracticeSearchMode;
}

export const isPracticeSearchMode = (
	value: unknown,
): value is PracticeSearchMode =>
	PRACTICE_SEARCH_MODES.some((mode) => mode === value);

export const parsePracticeSearch = (
	search: Record<string, unknown>,
): PracticeSearch =>
	isPracticeSearchMode(search.mode) ? { mode: search.mode } : {};
