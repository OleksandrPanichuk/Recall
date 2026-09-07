import { abandonAttemptCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const abandonAttemptDto = abandonAttemptCommandSchema;

export type AbandonAttemptDto = z.output<typeof abandonAttemptDto>;
