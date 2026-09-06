export const NEEDS_NO_CONFIG: readonly string[] = ["build", "test"];

export interface ScriptCheck {
	readonly name: string;
	readonly command: string;
}

export function filteredScripts(
	scripts: Readonly<Record<string, string>>,
): readonly ScriptCheck[] {
	return Object.entries(scripts)
		.filter(([, command]) => command.includes("run --filter"))
		.map(([name, command]) => ({ name, command }));
}

export function missingEnvFile(
	scripts: Readonly<Record<string, string>>,
	exempt: readonly string[] = NEEDS_NO_CONFIG,
): readonly string[] {
	return filteredScripts(scripts)
		.filter(
			({ name, command }) =>
				!exempt.includes(name) && !command.includes("--env-file="),
		)
		.map(({ name }) => name);
}
