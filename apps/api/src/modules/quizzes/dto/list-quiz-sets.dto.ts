import { listSetsCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const listQuizSetsDto = listSetsCommandSchema;

export type ListQuizSetsDto = z.output<typeof listQuizSetsDto>;
