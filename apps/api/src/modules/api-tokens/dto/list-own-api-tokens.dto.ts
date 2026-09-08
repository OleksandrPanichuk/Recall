import { listOwnApiTokensCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const listOwnApiTokensDto = listOwnApiTokensCommandSchema;

export type ListOwnApiTokensDto = z.output<typeof listOwnApiTokensDto>;
