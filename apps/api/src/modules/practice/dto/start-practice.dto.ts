import {
	ownPracticeCommandSchema,
	practiceCommandSchema,
} from "@recall/contracts";
import type { z } from "zod";

export const startPracticeDto = practiceCommandSchema;
export const startOwnPracticeDto = ownPracticeCommandSchema;

export type StartPracticeDto = z.output<typeof startPracticeDto>;
