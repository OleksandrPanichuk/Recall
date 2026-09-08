import { pauseAttemptCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const pauseAttemptDto = pauseAttemptCommandSchema;

export type PauseAttemptDto = z.output<typeof pauseAttemptDto>;
