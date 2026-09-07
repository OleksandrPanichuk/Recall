import { revokeOwnApiTokenCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const revokeOwnApiTokenDto = revokeOwnApiTokenCommandSchema;

export type RevokeOwnApiTokenDto = z.output<typeof revokeOwnApiTokenDto>;
