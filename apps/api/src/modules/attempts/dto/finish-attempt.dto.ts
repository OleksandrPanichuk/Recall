import { finishCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const finishAttemptDto = finishCommandSchema;

export type FinishAttemptDto = z.output<typeof finishAttemptDto>;
