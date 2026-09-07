import { updateSetCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const updateQuizSetDto = updateSetCommandSchema;

export type UpdateQuizSetDto = z.output<typeof updateQuizSetDto>;
