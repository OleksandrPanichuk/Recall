import { statisticsCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const getStatisticsDto = statisticsCommandSchema;

export type GetStatisticsDto = z.output<typeof getStatisticsDto>;
