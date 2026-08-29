import { createBridge } from "./bridge";
import { BridgeConfigurationError, loadConfiguration } from "./config";

async function main(): Promise<void> {
	let configuration: ReturnType<typeof loadConfiguration>;

	try {
		configuration = loadConfiguration(Bun.env);
	} catch (error) {
		if (error instanceof BridgeConfigurationError) {
			console.error(error.message);
			process.exit(1);
		}

		throw error;
	}

	if (process.argv.includes("--check")) {
		console.log(
			`Configuration is valid. endpoint=${configuration.endpoint.href}`,
		);

		return;
	}

	const bridge = createBridge({
		configuration,
		onWarning: (message) => {
			console.error(message);
		},
	});

	let writes = Promise.resolve();
	const writer = Bun.stdout.writer();

	const respond = (message: string): void => {
		writes = writes.then(async () => {
			writer.write(`${message}\n`);
			await writer.flush();
		});
	};

	const decoder = new TextDecoder();
	let pending = "";

	for await (const chunk of Bun.stdin.stream()) {
		pending += decoder.decode(chunk, { stream: true });

		const lines = pending.split("\n");

		pending = lines.pop() ?? "";

		for (const line of lines) {
			const trimmed = line.trim();

			if (trimmed.length === 0) {
				continue;
			}

			void bridge.handle(trimmed).then((answer) => {
				if (answer !== undefined) {
					respond(answer);
				}
			});
		}
	}

	await writes;
}

if (import.meta.main) {
	await main();
}
