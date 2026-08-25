export const SERVICE_NAMES = ["api", "bot", "admin"] as const;

export type ServiceName = (typeof SERVICE_NAMES)[number];

export interface PlannedService {
	readonly name: ServiceName;
	readonly entry: string;
	readonly host?: string;
	readonly port?: number;
	readonly url?: string;
	readonly skipped?: string;
}

export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_ADMIN_PORT = 8766;

const text = (value: string | undefined): string => (value ?? "").trim();

const isSet = (value: string | undefined): boolean => text(value).length > 0;

const hostOf = (value: string | undefined): string =>
	isSet(value) ? text(value) : DEFAULT_HOST;

const portOf = (value: string | undefined, fallback: number): number => {
	const parsed = Number(text(value));

	return Number.isSafeInteger(parsed) && parsed > 0 && parsed < 65536
		? parsed
		: fallback;
};

const reachable = (host: string): string =>
	host === "0.0.0.0" || host === "::" ? DEFAULT_HOST : host;

export function isServiceName(value: string): value is ServiceName {
	return (SERVICE_NAMES as readonly string[]).includes(value);
}

export function selectionFrom(argv: readonly string[]): {
	readonly only: readonly ServiceName[];
	readonly unknown: readonly string[];
} {
	const flag = argv.findIndex(
		(argument) => argument === "--only" || argument.startsWith("--only="),
	);

	if (flag === -1) {
		return { only: [], unknown: [] };
	}

	const argument = argv[flag] ?? "";
	const value = argument.startsWith("--only=")
		? argument.slice("--only=".length)
		: (argv[flag + 1] ?? "");
	const requested = value
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

	return {
		only: requested.filter(isServiceName),
		unknown: requested.filter((part) => !isServiceName(part)),
	};
}

export function planServices(
	env: EnvironmentSource,
	only: readonly ServiceName[] = [],
): readonly PlannedService[] {
	const wanted = (name: ServiceName): string | undefined =>
		only.length === 0 || only.includes(name)
			? undefined
			: "not selected by --only";

	const adminHost = hostOf(env.ADMIN_HOST);
	const adminPort = portOf(env.ADMIN_PORT, DEFAULT_ADMIN_PORT);

	const botSkipped =
		wanted("bot") ??
		(isSet(env.BOT_API_TOKEN) ? undefined : "BOT_API_TOKEN is not set");
	const adminSkipped =
		wanted("admin") ??
		(isSet(env.ADMIN_PASSPHRASE) || isSet(env.MCP_OAUTH_PASSPHRASE)
			? undefined
			: "neither ADMIN_PASSPHRASE nor MCP_OAUTH_PASSPHRASE is set");

	const apiHost = env.API_HOST ?? "127.0.0.1";
	const apiPort = Number(env.API_PORT ?? 8767);

	return [
		{
			name: "api",
			entry: "apps/api/src/entrypoints/api.ts",
			...(wanted("api") === undefined
				? {
						host: apiHost,
						port: apiPort,
						url: `http://${reachable(apiHost)}:${apiPort}/docs`,
					}
				: { skipped: wanted("api") }),
		},
		{
			name: "bot",
			entry: "apps/bot/src/main.ts",
			skipped: botSkipped,
		},
		{
			name: "admin",
			entry: "apps/admin/src/server.ts",
			...(adminSkipped === undefined
				? {
						host: adminHost,
						port: adminPort,
						url: `http://${reachable(adminHost)}:${adminPort}`,
					}
				: { skipped: adminSkipped }),
		},
	];
}

export const running = (
	plan: readonly PlannedService[],
): readonly PlannedService[] =>
	plan.filter((service) => service.skipped === undefined);

export function describePlan(
	plan: readonly PlannedService[],
): readonly string[] {
	const width = Math.max(...plan.map((service) => service.name.length));

	return plan.map((service) => {
		const name = service.name.padEnd(width);

		if (service.skipped !== undefined) {
			return `${name}  skipped — ${service.skipped}`;
		}

		return `${name}  ${service.url ?? "starting"}`;
	});
}
