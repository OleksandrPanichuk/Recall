import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const source = (path: string): string =>
	fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
	server: { port: Number(process.env.WEB_PORT ?? 3000) },
	resolve: {
		alias: {
			"@": source("./src"),
			// The package's exports point node at dist; this app compiles the source
			// instead, so editing a contract does not need a rebuild first.
			"@recall/contracts": source("../../packages/contracts/src/index.ts"),
		},
	},
	// Nitro turns the fetch handler into a server that actually listens; the bun
	// preset is the one the plan settled on.
	plugins: [
		tailwindcss(),
		tanstackStart(),
		nitro({ preset: "bun" }),
		viteReact(),
	],
});
