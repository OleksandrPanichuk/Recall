import { z } from "zod";

export interface ApiEnvironment {
	readonly databaseUrl: string;
	readonly host: string;
	readonly port: number;
}

const schema = z.object({
	DATABASE_URL: z.string().trim().min(1),
	API_HOST: z.string().trim().min(1).default("127.0.0.1"),
	API_PORT: z.coerce.number().int().positive().max(65535).default(8767),
});

export class ApiEnvironmentError extends Error {
	constructor(issues: readonly string[]) {
		super(
			`Invalid API configuration:\n${issues.map((i) => `- ${i}`).join("\n")}`,
		);
		this.name = "ApiEnvironmentError";
	}
}

export function loadApiEnvironment(
	source: Readonly<Record<string, string | undefined>> = process.env,
): ApiEnvironment {
	const parsed = schema.safeParse(source);

	if (!parsed.success) {
		throw new ApiEnvironmentError(
			parsed.error.issues.map(
				(issue) => `${issue.path.join(".")}: ${issue.message}`,
			),
		);
	}

	return {
		databaseUrl: parsed.data.DATABASE_URL,
		host: parsed.data.API_HOST,
		port: parsed.data.API_PORT,
	};
}
