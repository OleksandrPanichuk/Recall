import type { BridgeConfiguration } from "./config";

export type Fetch = (
	input: string | URL,
	init?: RequestInit,
) => Promise<Response>;

export interface BridgeDependencies {
	readonly configuration: BridgeConfiguration;
	readonly fetch?: Fetch;
	readonly onWarning?: (message: string) => void;
}

interface Envelope {
	readonly id?: unknown;
	readonly method?: unknown;
}

const PARSE_ERROR = -32700;
const INTERNAL_ERROR = -32603;

const errorOf = (id: unknown, code: number, message: string) => ({
	jsonrpc: "2.0",
	id: id ?? null,
	error: { code, message },
});

const errorFor = (id: unknown, code: number, message: string): string =>
	JSON.stringify(errorOf(id, code, message));

const errorsFor = (
	payload: unknown,
	ids: readonly unknown[],
	message: string,
): string | undefined => {
	if (ids.length === 0) {
		return undefined;
	}

	return Array.isArray(payload)
		? JSON.stringify(ids.map((id) => errorOf(id, INTERNAL_ERROR, message)))
		: errorFor(ids[0], INTERNAL_ERROR, message);
};

interface Answer {
	readonly jsonrpc?: unknown;
	readonly id?: unknown;
	readonly error?: { readonly message?: unknown };
	readonly result?: unknown;
}

const isAnswer = (value: unknown): value is Answer =>
	typeof value === "object" &&
	value !== null &&
	!Array.isArray(value) &&
	(value as Answer).jsonrpc === "2.0" &&
	("error" in value || "result" in value);

const answersEvery = (
	answers: readonly Answer[],
	ids: readonly unknown[],
): boolean =>
	answers.length === ids.length &&
	ids.every((id) => answers.some((answer) => answer.id === id));

const refusalFrom = (
	payload: unknown,
	ids: readonly unknown[],
	body: string,
	fallback: string,
): string | undefined => {
	let parsed: unknown;

	try {
		parsed = JSON.parse(body);
	} catch {
		return errorsFor(payload, ids, fallback);
	}

	const answers = Array.isArray(parsed) ? parsed : [parsed];

	if (
		answers.every(isAnswer) &&
		Array.isArray(parsed) === Array.isArray(payload) &&
		answersEvery(answers, ids)
	) {
		return body;
	}

	const message = answers.find(isAnswer)?.error?.message;

	return errorsFor(
		payload,
		ids,
		typeof message === "string" ? `${fallback}: ${message}` : fallback,
	);
};

const idsOf = (payload: unknown): unknown[] => {
	const envelopes: Envelope[] = Array.isArray(payload)
		? (payload as Envelope[])
		: [payload as Envelope];

	return envelopes
		.filter((envelope) => envelope !== null && envelope.id !== undefined)
		.map((envelope) => envelope.id);
};

const readEventStream = async (
	response: Response,
): Promise<string | undefined> => {
	const body = await response.text();
	const payloads = body
		.split(/\r?\n/)
		.filter((line) => line.startsWith("data:"))
		.map((line) => line.slice("data:".length).trim())
		.filter((line) => line.length > 0);

	return payloads.at(-1);
};

export function createBridge(dependencies: BridgeDependencies) {
	const { configuration, onWarning } = dependencies;
	const send = dependencies.fetch ?? fetch;

	return {
		async handle(line: string): Promise<string | undefined> {
			let payload: unknown;

			try {
				payload = JSON.parse(line);
			} catch {
				return errorFor(
					null,
					PARSE_ERROR,
					"the bridge could not parse that line as json",
				);
			}

			const ids = idsOf(payload);

			let response: Response;

			try {
				response = await send(configuration.endpoint, {
					method: "POST",
					headers: {
						authorization: `Bearer ${configuration.token}`,
						"content-type": "application/json",
						accept: "application/json, text/event-stream",
					},
					body: line,
					signal: AbortSignal.timeout(configuration.timeoutMs),
				});
			} catch (error) {
				const message = `the recall api at ${configuration.endpoint.href} could not be reached: ${error instanceof Error ? error.message : String(error)}`;

				onWarning?.(message);

				return errorsFor(payload, ids, message);
			}

			if (response.status === 202 || response.status === 204) {
				return undefined;
			}

			if (!response.ok) {
				const message = `the recall api answered ${response.status} ${response.statusText}`;

				onWarning?.(message);

				if (ids.length === 0) {
					return undefined;
				}

				try {
					return refusalFrom(
						payload,
						ids,
						(await response.text()).trim(),
						message,
					);
				} catch {
					return errorsFor(payload, ids, message);
				}
			}

			const contentType = response.headers.get("content-type") ?? "";

			let body: string | undefined;

			try {
				body = contentType.includes("text/event-stream")
					? await readEventStream(response)
					: (await response.text()).trim();
			} catch (error) {
				const message = `the recall api's answer could not be read: ${error instanceof Error ? error.message : String(error)}`;

				onWarning?.(message);

				return errorsFor(payload, ids, message);
			}

			if (body === undefined || body.length === 0) {
				return undefined;
			}

			return body;
		},
	};
}
