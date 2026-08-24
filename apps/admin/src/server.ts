import index from "./index.html";

const port = Number(Bun.env.ADMIN_PORT ?? 8766);
const hostname = Bun.env.ADMIN_HOST ?? "127.0.0.1";
const apiUrl = Bun.env.API_URL ?? "http://127.0.0.1:8767";

const server = Bun.serve({
	hostname,
	port,
	routes: {
		"/": index,
		// The bundle is static, so the API location is served rather than compiled in.
		"/config.json": () => Response.json({ apiUrl }),
	},
	development: Bun.argv.includes("--debug"),
});

console.log(
	`admin ready on http://${server.hostname}:${server.port} → ${apiUrl}`,
);
