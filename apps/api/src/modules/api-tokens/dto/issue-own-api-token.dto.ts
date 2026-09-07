import { issueOwnApiTokenCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const issueOwnApiTokenDto = issueOwnApiTokenCommandSchema;

export type IssueOwnApiTokenDto = z.output<typeof issueOwnApiTokenDto>;
