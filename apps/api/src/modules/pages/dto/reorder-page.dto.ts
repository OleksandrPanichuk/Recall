import { reorderPageCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const reorderPageDto = reorderPageCommandSchema;

export type ReorderPageDto = z.output<typeof reorderPageDto>;
