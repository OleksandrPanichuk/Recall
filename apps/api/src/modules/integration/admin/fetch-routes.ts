import type {
	Request as ExpressRequest,
	Response as ExpressResponse,
	NextFunction,
} from "express";

export type FetchHandler = (request: Request) => Promise<Response> | Response;
export type FetchRouteTable = Readonly<
	Record<string, Readonly<Record<string, FetchHandler>>>
>;

interface CompiledRoute {
	readonly matcher: RegExp;
	readonly keys: readonly string[];
	readonly methods: Readonly<Record<string, FetchHandler>>;
}

const compile = (routes: FetchRouteTable): readonly CompiledRoute[] =>
	Object.entries(routes).map(([pattern, methods]) => ({
		matcher: new RegExp(
			`^${pattern.replace(/:[A-Za-z]+/g, "([^/]+)").replace(/\//g, "\\/")}$`,
		),
		keys: [...pattern.matchAll(/:([A-Za-z]+)/g)].map(([, key]) => key ?? ""),
		methods,
	}));

const bodyOf = (request: ExpressRequest): string | undefined => {
	if (request.method === "GET" || request.method === "HEAD") {
		return undefined;
	}

	// Nest's body parser has already drained the stream, so the Fetch Request is
	// rebuilt from what it parsed rather than from the socket.
	return request.body === undefined ? undefined : JSON.stringify(request.body);
};

// The admin route table is written against the Fetch API because it was served by
// Bun.serve. Rather than rewrite six hundred lines of handlers to move the admin
// API into the Nest app, they are adapted at the boundary. Replacing them with
// native controllers is a separate, incremental job.
export function fetchRoutes(routes: FetchRouteTable) {
	const compiled = compile(routes);

	return async (
		request: ExpressRequest,
		response: ExpressResponse,
		next: NextFunction,
	): Promise<void> => {
		// Nest mounts this middleware behind a wildcard, so request.path is relative
		// to that mount and always "/". The real path is on originalUrl.
		const url = new URL(
			request.originalUrl,
			`http://${request.headers.host ?? "localhost"}`,
		);

		for (const route of compiled) {
			const match = route.matcher.exec(url.pathname);

			if (match === null) {
				continue;
			}

			const handler = route.methods[request.method];

			if (handler === undefined) {
				continue;
			}

			const incoming = new Request(url, {
				method: request.method,
				headers: new Headers(
					Object.entries(request.headers).flatMap(([name, value]) =>
						typeof value === "string"
							? [[name, value] as [string, string]]
							: [],
					),
				),
				body: bodyOf(request),
			});

			Object.defineProperty(incoming, "params", {
				value: Object.fromEntries(
					route.keys.map((key, index) => [
						key,
						decodeURIComponent(match[index + 1] ?? ""),
					]),
				),
			});

			const result = await handler(incoming);

			for (const cookie of result.headers.getSetCookie()) {
				response.append("set-cookie", cookie);
			}

			// content-length and transfer-encoding describe the Fetch response's own
			// framing; Express sets its own and duplicates break strict clients.
			const framing = new Set([
				"set-cookie",
				"content-length",
				"transfer-encoding",
				"connection",
			]);

			result.headers.forEach((value, name) => {
				if (!framing.has(name.toLowerCase())) {
					response.setHeader(name, value);
				}
			});

			response.status(result.status);

			const text = await result.text();

			if (text.length === 0) {
				response.end();
			} else {
				response.send(text);
			}

			return;
		}

		next();
	};
}
