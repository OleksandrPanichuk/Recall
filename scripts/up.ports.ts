export interface PortHolder {
	readonly pid: number;
	readonly command?: string;
}

export function parseLsofHolder(stdout: string): PortHolder | undefined {
	let pid: number | undefined;
	let command: string | undefined;

	for (const line of stdout.split("\n")) {
		const field = line.trim();

		if (field.startsWith("p")) {
			const parsed = Number(field.slice(1));

			if (Number.isSafeInteger(parsed) && parsed > 0) {
				pid = parsed;
			}
		}

		if (field.startsWith("c") && pid !== undefined && command === undefined) {
			command = field.slice(1);
		}
	}

	return pid === undefined ? undefined : { pid, ...(command && { command }) };
}

export function parseNetstatHolder(
	stdout: string,
	port: number,
): PortHolder | undefined {
	for (const line of stdout.split("\n")) {
		const columns = line.trim().split(/\s+/);

		if (columns.length < 5 || columns[3] !== "LISTENING") {
			continue;
		}

		const local = columns[1] ?? "";
		const parsed = Number(columns[4]);

		if (
			local.endsWith(`:${port}`) &&
			Number.isSafeInteger(parsed) &&
			parsed > 0
		) {
			return { pid: parsed };
		}
	}

	return undefined;
}

export function killCommand(pid: number, platform: string): string {
	return platform === "win32" ? `taskkill /PID ${pid} /F` : `kill ${pid}`;
}

export function openCommand(
	platform: string,
	url: string,
): readonly [string, readonly string[]] {
	if (platform === "win32") {
		return ["cmd", ["/c", "start", "", url]];
	}

	return platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
}

export function openInBrowser(url: string): void {
	const [command, args] = openCommand(process.platform, url);

	try {
		Bun.spawn([command, ...args], { stdout: "ignore", stderr: "ignore" });
	} catch {
		return;
	}
}

export async function isPortFree(host: string, port: number): Promise<boolean> {
	const hostname = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;

	try {
		const socket = await Bun.connect({
			hostname,
			port,
			socket: { data: () => {} },
		});

		socket.end();

		return false;
	} catch {
		return true;
	}
}

export async function findPortHolder(
	port: number,
): Promise<PortHolder | undefined> {
	const [command, args] =
		process.platform === "win32"
			? ["netstat", ["-ano", "-p", "TCP"]]
			: ["lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpc"]];

	try {
		const child = Bun.spawn([command as string, ...(args as string[])], {
			stdout: "pipe",
			stderr: "ignore",
		});
		const stdout = await new Response(child.stdout).text();

		await child.exited;

		return process.platform === "win32"
			? parseNetstatHolder(stdout, port)
			: parseLsofHolder(stdout);
	} catch {
		return undefined;
	}
}

export async function waitForHttp(
	url: string,
	timeoutMs: number,
): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		try {
			await fetch(url, {
				method: "GET",
				signal: AbortSignal.timeout(1000),
			});

			return true;
		} catch {
			await Bun.sleep(100);
		}
	}

	return false;
}
