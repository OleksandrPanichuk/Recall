import { writeSummaryCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const writeSummaryDto = writeSummaryCommandSchema;

export type WriteSummaryDto = z.output<typeof writeSummaryDto>;
