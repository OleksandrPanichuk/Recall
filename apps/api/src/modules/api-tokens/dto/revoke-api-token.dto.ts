import { revokeApiTokenCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const revokeApiTokenDto = revokeApiTokenCommandSchema;

export type RevokeApiTokenDto = z.output<typeof revokeApiTokenDto>;
