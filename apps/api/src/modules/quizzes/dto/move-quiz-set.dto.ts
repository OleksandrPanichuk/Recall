import { moveSetCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const moveQuizSetDto = moveSetCommandSchema;

export type MoveQuizSetDto = z.output<typeof moveQuizSetDto>;
