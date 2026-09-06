export const STAMP_PATTERN = /^\d{8}-\d{6}$/;

const pad = (value: number, width = 2): string =>
	String(value).padStart(width, "0");

export function stampFor(at: Date): string {
	return [
		`${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}`,
		`${pad(at.getUTCHours())}${pad(at.getUTCMinutes())}${pad(at.getUTCSeconds())}`,
	].join("-");
}

export function stampsIn(names: readonly string[]): readonly string[] {
	return [...names].filter((name) => STAMP_PATTERN.test(name)).sort();
}

export function newestStamp(names: readonly string[]): string | undefined {
	return stampsIn(names).at(-1);
}

export function prunable(
	names: readonly string[],
	keep: number,
): readonly string[] {
	const stamps = stampsIn(names);

	return keep <= 0
		? stamps
		: stamps.slice(0, Math.max(0, stamps.length - keep));
}

export interface PostgresTarget {
	readonly user: string;
	readonly database: string;
}

export function postgresTargetFrom(url: string | undefined): PostgresTarget {
	const fallback: PostgresTarget = { user: "recall", database: "recall" };

	if (url === undefined || url.trim().length === 0) {
		return fallback;
	}

	let parsed: URL;

	try {
		parsed = new URL(url);
	} catch {
		return fallback;
	}

	const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));

	return {
		user: decodeURIComponent(parsed.username) || fallback.user,
		database: database.length === 0 ? fallback.database : database,
	};
}

const DUMP_HEADER = "PostgreSQL database dump";

export function looksLikeDump(head: string): boolean {
	return head.trimStart().startsWith("--") && head.includes(DUMP_HEADER);
}
