import { startAttemptCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const startAttemptDto = startAttemptCommandSchema;

export type StartAttemptDto = z.output<typeof startAttemptDto>;
