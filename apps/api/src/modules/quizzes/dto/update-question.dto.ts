import { updateQuestionCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const updateQuestionDto = updateQuestionCommandSchema;

export type UpdateQuestionDto = z.output<typeof updateQuestionDto>;
