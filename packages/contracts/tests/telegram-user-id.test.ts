import { describe, expect, test } from "bun:test";
import {
	issueApiTokenCommandSchema,
	listApiTokensCommandSchema,
	loginLinkCommandSchema,
	practiceCommandSchema,
	revokeApiTokenCommandSchema,
	startAttemptCommandSchema,
	telegramUserIdSchema,
} from "../src/bot";

const wide = 8_123_456_789;

describe("a Telegram user id", () => {
	test("accepts an id that does not fit in 32 bits", () => {
		expect(telegramUserIdSchema.parse(wide)).toBe(wide);
	});

	test.each([
		0,
		-5,
		1.5,
		Number.MAX_SAFE_INTEGER + 1,
	])("refuses %p", (value) => {
		expect(telegramUserIdSchema.safeParse(value).success).toBe(false);
	});

	test("is what every command naming a Telegram user checks", () => {
		const quizSetId = "set";
		const commands = [
			[loginLinkCommandSchema, {}],
			[issueApiTokenCommandSchema, { name: "laptop" }],
			[listApiTokensCommandSchema, {}],
			[revokeApiTokenCommandSchema, { tokenId: "token" }],
			[startAttemptCommandSchema, { quizSetId }],
			[practiceCommandSchema, { quizSetId, mode: "mistakes" }],
		] as const;

		for (const [schema, rest] of commands) {
			expect(schema.safeParse({ ...rest, telegramUserId: wide }).success).toBe(
				true,
			);
			expect(schema.safeParse({ ...rest, telegramUserId: -1 }).success).toBe(
				false,
			);
		}
	});
});
