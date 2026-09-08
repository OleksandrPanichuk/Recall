import { deleteQuestionCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const deleteQuestionDto = deleteQuestionCommandSchema;

export type DeleteQuestionDto = z.output<typeof deleteQuestionDto>;
