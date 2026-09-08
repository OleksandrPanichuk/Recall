import { leechesCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const listLeechesDto = leechesCommandSchema;

export type ListLeechesDto = z.output<typeof listLeechesDto>;
