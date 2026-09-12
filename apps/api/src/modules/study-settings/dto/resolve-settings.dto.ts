import { resolveSettingsCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const resolveSettingsDto = resolveSettingsCommandSchema;

export type ResolveSettingsDto = z.output<typeof resolveSettingsDto>;
