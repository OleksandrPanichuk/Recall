import { describe, expect, test } from "bun:test";
import {
	CALLBACK_DATA_LIMIT,
	CallbackTooLongError,
	decodeCallback,
	encodeCallback,
} from "./callback-data";
import { CallbackAction } from "./callback-data.constants";

describe("callback data limit", () => {
	test("is counted in bytes, not characters", () => {
		const questionId = "я".repeat(32);

		expect(`${CallbackAction.Reveal}:${questionId}`.length).toBeLessThan(
			CALLBACK_DATA_LIMIT,
		);
		expect(() =>
			encodeCallback({ action: CallbackAction.Reveal, questionId }),
		).toThrow(CallbackTooLongError);
	});

	test("data that fits in 64 bytes round-trips", () => {
		const questionId = "0f8c2d3e-5b6a-4c7d-8e9f-0a1b2c3d4e5f";
		const data = encodeCallback({ action: CallbackAction.Reveal, questionId });

		expect(new TextEncoder().encode(data).length).toBeLessThanOrEqual(
			CALLBACK_DATA_LIMIT,
		);
		expect(decodeCallback(data)).toEqual({
			action: CallbackAction.Reveal,
			questionId,
		});
	});
});
