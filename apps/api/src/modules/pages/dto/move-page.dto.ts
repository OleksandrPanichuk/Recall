import { movePageCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const movePageDto = movePageCommandSchema;

export type MovePageDto = z.output<typeof movePageDto>;
