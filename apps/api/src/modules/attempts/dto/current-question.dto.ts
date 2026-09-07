import { currentQuestionCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const currentQuestionDto = currentQuestionCommandSchema;

export type CurrentQuestionDto = z.output<typeof currentQuestionDto>;
