import { describe, expect, test } from "bun:test";
import {
	filteredScripts,
	missingEnvFile,
	NEEDS_NO_CONFIG,
} from "./root-scripts.lib";

const rootScripts = async (): Promise<Readonly<Record<string, string>>> => {
	const manifest = (await Bun.file(
		Bun.fileURLToPath(new URL("../package.json", import.meta.url)),
	).json()) as { scripts: Record<string, string> };

	return manifest.scripts;
};

describe("root scripts that run a workspace package", () => {
	test("carry --env-file, because bun run --filter starts the child without .env", async () => {
		expect(missingEnvFile(await rootScripts())).toEqual([]);
	});

	test("and there are some, so this test is not vacuously green", async () => {
		expect(filteredScripts(await rootScripts()).length).toBeGreaterThan(5);
	});

	test("only build and test are exempt, and both really take no configuration", async () => {
		const scripts = await rootScripts();

		for (const name of NEEDS_NO_CONFIG) {
			expect(scripts[name]).toBeDefined();
		}
	});
});

describe("the rule itself", () => {
	test("catches a filtered script with no env file", () => {
		expect(
			missingEnvFile({ bot: "bun run --filter '@recall/bot' start" }),
		).toEqual(["bot"]);
	});

	test("accepts one that has it", () => {
		expect(
			missingEnvFile({
				bot: "bun --env-file=.env run --filter '@recall/bot' start",
			}),
		).toEqual([]);
	});

	test("ignores a script that runs nothing through the workspace filter", () => {
		expect(missingEnvFile({ up: "bun run ./scripts/up.ts" })).toEqual([]);
	});

	test("and honours the exemptions rather than hard-coding them", () => {
		expect(
			missingEnvFile({ anything: "bun run --filter 'x' y" }, ["anything"]),
		).toEqual([]);
	});
});
