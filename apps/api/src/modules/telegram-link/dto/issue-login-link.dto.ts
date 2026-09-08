import { loginLinkCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const issueLoginLinkDto = loginLinkCommandSchema;

export type IssueLoginLinkDto = z.output<typeof issueLoginLinkDto>;
