import {
	startAttemptCommandSchema,
	startOwnAttemptCommandSchema,
} from "@recall/contracts";
import type { z } from "zod";

export const startAttemptDto = startAttemptCommandSchema;
export const startOwnAttemptDto = startOwnAttemptCommandSchema;

export type StartAttemptDto = z.output<typeof startAttemptDto>;
