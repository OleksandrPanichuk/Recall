import { deletePageCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const deletePageDto = deletePageCommandSchema;

export type DeletePageDto = z.output<typeof deletePageDto>;
