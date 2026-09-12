import { insightsCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const getInsightsDto = insightsCommandSchema;

export type GetInsightsDto = z.output<typeof getInsightsDto>;
