import { attemptDetailCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const getAttemptDetailDto = attemptDetailCommandSchema;

export type GetAttemptDetailDto = z.output<typeof getAttemptDetailDto>;
