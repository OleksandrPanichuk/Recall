import { addQuestionsCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const addQuestionsDto = addQuestionsCommandSchema;

export type AddQuestionsDto = z.output<typeof addQuestionsDto>;
