import { BadRequestException } from "@nestjs/common";
import type { z } from "zod";

export function parseBody<Schema extends z.ZodType>(
	schema: Schema,
	body: unknown,
): z.output<Schema> {
	const parsed = schema.safeParse(body ?? {});

	if (!parsed.success) {
		throw new BadRequestException({
			statusCode: 400,
			error: "BotRequestValidationError",
			message: parsed.error.issues
				.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
				.join("; "),
		});
	}

	return parsed.data;
}
