import { issueApiTokenCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const issueApiTokenDto = issueApiTokenCommandSchema;

export type IssueApiTokenDto = z.output<typeof issueApiTokenDto>;
