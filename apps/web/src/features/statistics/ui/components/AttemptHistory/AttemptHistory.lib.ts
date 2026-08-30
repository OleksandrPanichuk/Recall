export const day = (at?: string): string =>
	at === undefined ? "не завершено" : at.slice(0, 10);
