import { listQuestionsCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const listQuestionsDto = listQuestionsCommandSchema;

export type ListQuestionsDto = z.output<typeof listQuestionsDto>;
