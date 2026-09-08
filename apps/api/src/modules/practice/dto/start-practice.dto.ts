import { practiceCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const startPracticeDto = practiceCommandSchema;

export type StartPracticeDto = z.output<typeof startPracticeDto>;
