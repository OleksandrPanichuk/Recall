import { searchPagesCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const searchPagesDto = searchPagesCommandSchema;

export type SearchPagesDto = z.output<typeof searchPagesDto>;
