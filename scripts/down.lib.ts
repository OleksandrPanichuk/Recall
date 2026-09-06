export interface Target {
	readonly label: string;
	readonly port?: number;
	readonly match?: string;
}

export const portOf = (addr: string): number | undefined => {
	const port = Number(/:(\d+)\s*$/.exec(addr.trim())?.[1]);

	return Number.isSafeInteger(port) && port > 0 ? port : undefined;
};

export const ownsTunnel = (addr: string, ports: readonly number[]): boolean => {
	const port = portOf(addr);

	return port !== undefined && ports.includes(port);
};

export const isOurs = (command: string, root: string): boolean =>
	command.includes(root);

export function targetsFrom(
	services: readonly { name: string; port?: number }[],
	botPort: number,
): readonly Target[] {
	const listening = services
		.filter(
			(service): service is { name: string; port: number } =>
				service.port !== undefined,
		)
		.map((service) => ({ label: service.name, port: service.port }));

	return [
		...listening,
		{ label: "bot webhook", port: botPort },
		{ label: "supervisor", match: "scripts/up.ts" },
		{ label: "bot", match: "apps/bot/src/main.ts" },
		{ label: "web dev server", match: "@recall/web" },
	];
}
