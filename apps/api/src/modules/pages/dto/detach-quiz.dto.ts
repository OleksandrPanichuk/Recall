import { detachQuizCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const detachQuizDto = detachQuizCommandSchema;

export type DetachQuizDto = z.output<typeof detachQuizDto>;
