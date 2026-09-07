import { unsharePageCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const unsharePageDto = unsharePageCommandSchema;

export type UnsharePageDto = z.output<typeof unsharePageDto>;
