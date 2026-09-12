import { listRevisionsCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const listRevisionsDto = listRevisionsCommandSchema;

export type ListRevisionsDto = z.output<typeof listRevisionsDto>;
