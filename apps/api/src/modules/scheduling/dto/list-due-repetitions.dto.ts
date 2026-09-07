import { dueRepetitionsCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const listDueRepetitionsDto = dueRepetitionsCommandSchema;

export type ListDueRepetitionsDto = z.output<typeof listDueRepetitionsDto>;
