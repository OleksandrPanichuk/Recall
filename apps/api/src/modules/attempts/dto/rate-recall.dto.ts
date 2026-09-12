import { rateRecallCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const rateRecallDto = rateRecallCommandSchema;

export type RateRecallDto = z.output<typeof rateRecallDto>;
