import { setPageIconCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const setPageIconDto = setPageIconCommandSchema;

export type SetPageIconDto = z.output<typeof setPageIconDto>;
