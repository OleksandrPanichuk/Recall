import { listApiTokensCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const listApiTokensDto = listApiTokensCommandSchema;

export type ListApiTokensDto = z.output<typeof listApiTokensDto>;
