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
			"@recall/contracts": source("../../packages/contracts/src/index.ts"),
			"@recall/kit/shuffle": source("../../packages/kit/src/utils/shuffle.ts"),
		},
	},
	plugins: [
		tailwindcss(),
		tanstackStart(),
		nitro({ preset: "bun" }),
		viteReact(),
	],
});
