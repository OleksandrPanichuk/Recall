import { createPageCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const createPageDto = createPageCommandSchema;

export type CreatePageDto = z.output<typeof createPageDto>;
