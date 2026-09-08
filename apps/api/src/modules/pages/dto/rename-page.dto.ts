import { renamePageCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const renamePageDto = renamePageCommandSchema;

export type RenamePageDto = z.output<typeof renamePageDto>;
