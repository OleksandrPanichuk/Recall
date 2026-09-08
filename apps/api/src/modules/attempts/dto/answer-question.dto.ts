import { answerCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const answerQuestionDto = answerCommandSchema;

export type AnswerQuestionDto = z.output<typeof answerQuestionDto>;
