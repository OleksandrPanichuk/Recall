import { updateVocabularyCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const updateVocabularyDto = updateVocabularyCommandSchema;

export type UpdateVocabularyDto = z.output<typeof updateVocabularyDto>;
