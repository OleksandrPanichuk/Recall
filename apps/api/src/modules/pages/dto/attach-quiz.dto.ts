import { attachQuizCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const attachQuizDto = attachQuizCommandSchema;

export type AttachQuizDto = z.output<typeof attachQuizDto>;
