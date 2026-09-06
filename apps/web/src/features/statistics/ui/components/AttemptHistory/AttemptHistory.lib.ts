export const day = (at?: string): string =>
	at === undefined ? "unfinished" : at.slice(0, 10);
