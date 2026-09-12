import { sharePageCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const sharePageDto = sharePageCommandSchema;

export type SharePageDto = z.output<typeof sharePageDto>;
