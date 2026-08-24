import { defineConfig } from "drizzle-kit";

export default defineConfig({
	dialect: "sqlite",
	schema: "./src/adapters/persistence/sqlite/schema.ts",
	out: "./drizzle",
	dbCredentials: {
		url: process.env.OAUTH_DATABASE_PATH ?? "./data/oauth.sqlite",
	},
});
