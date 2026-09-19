import { retireQuestionCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const retireQuestionDto = retireQuestionCommandSchema;

export type RetireQuestionDto = z.output<typeof retireQuestionDto>;
