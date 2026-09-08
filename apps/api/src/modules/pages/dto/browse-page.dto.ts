import { browseCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const browsePageDto = browseCommandSchema;

export type BrowsePageDto = z.output<typeof browsePageDto>;
