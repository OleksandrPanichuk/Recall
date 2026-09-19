import { retiredCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const listRetiredDto = retiredCommandSchema;

export type ListRetiredDto = z.output<typeof listRetiredDto>;
