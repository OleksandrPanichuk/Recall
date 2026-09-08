import { updateSettingsCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const updateSettingsDto = updateSettingsCommandSchema;

export type UpdateSettingsDto = z.output<typeof updateSettingsDto>;
