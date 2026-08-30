export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export const UNREACHABLE_HINT =
	"start it with: bun run db:up (Postgres 17 in Docker on port 55432)";

const DEFAULT_PORT = 5432;

export interface DatabaseTarget {
	readonly host: string;
	readonly port: number;
}

export function databaseUrlOf(source: EnvironmentSource): string | undefined {
	const url = (source.DATABASE_URL ?? "").trim();

	return url.length === 0 ? undefined : url;
}

export function targetOf(url: string): DatabaseTarget | undefined {
	try {
		const parsed = new URL(url);

		if (parsed.hostname === "") {
			return undefined;
		}

		return {
			host: parsed.hostname,
			port: parsed.port === "" ? DEFAULT_PORT : Number(parsed.port),
		};
	} catch {
		return undefined;
	}
}

export function describeTarget(url: string): string {
	try {
		const parsed = new URL(url);

		return `${parsed.host}${parsed.pathname}`;
	} catch {
		return "(unparseable DATABASE_URL)";
	}
}
