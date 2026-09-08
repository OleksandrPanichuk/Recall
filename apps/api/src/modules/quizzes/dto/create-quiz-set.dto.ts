import { createSetCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const createQuizSetDto = createSetCommandSchema;

export type CreateQuizSetDto = z.output<typeof createQuizSetDto>;
