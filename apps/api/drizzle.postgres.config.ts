import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/persistence/postgres/schema.ts",
	out: "./drizzle-postgres",
	dbCredentials: {
		url:
			process.env.DATABASE_URL ??
			"postgres://recall:recall@127.0.0.1:55432/recall",
	},
});
