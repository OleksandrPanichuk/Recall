import { quizSetIdCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const quizSetIdDto = quizSetIdCommandSchema;

export type QuizSetIdDto = z.output<typeof quizSetIdDto>;
