import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { ApiErrorName } from "@recall/contracts";
import { ModuleError } from "@/core/errors";
import { legacyErrorNames } from "@/shared/http/legacy-error-map";

const SOURCE = join(import.meta.dir, "../../src");

const sourceFiles = async (): Promise<readonly string[]> => {
	const files: string[] = [];

	for await (const path of new Bun.Glob("**/*.ts").scan(SOURCE)) {
		if (!path.endsWith(".test.ts")) {
			files.push(join(SOURCE, path));
		}
	}

	return files;
};

const moduleErrorNames = async (): Promise<ReadonlySet<string>> => {
	const names = new Set<string>();

	for (const file of await sourceFiles()) {
		if (!(await Bun.file(file).text()).includes("extends ModuleError")) {
			continue;
		}

		const exported: Record<string, unknown> = await import(file);

		for (const value of Object.values(exported)) {
			if (
				typeof value === "function" &&
				value.prototype instanceof ModuleError
			) {
				names.add(value.name);
			}
		}
	}

	return names;
};

const declaredErrorClasses = async (): Promise<ReadonlySet<string>> => {
	const names = new Set<string>();

	for (const file of await sourceFiles()) {
		const text = await Bun.file(file).text();

		for (const match of text.matchAll(/class (\w+Error) extends \w*Error\b/g)) {
			names.add(match[1] as string);
		}
	}

	return names;
};

const isLegacy = (name: string): boolean => legacyErrorNames.includes(name);

describe("the error names clients match on", () => {
	test("every ApiErrorName is an error the api really answers with", async () => {
		const modules = await moduleErrorNames();
		const unanswered = Object.values(ApiErrorName).filter(
			(name) => !modules.has(name) && !isLegacy(name),
		);

		expect(unanswered).toEqual([]);
	});

	test("every name in the legacy table is a class the api declares", async () => {
		const declared = await declaredErrorClasses();
		const modules = await moduleErrorNames();

		expect(legacyErrorNames.filter((name) => !declared.has(name))).toEqual([]);
		expect(legacyErrorNames.filter((name) => modules.has(name))).toEqual([]);
	});
});
