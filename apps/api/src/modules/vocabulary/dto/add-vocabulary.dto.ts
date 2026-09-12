import { addVocabularyCommandSchema } from "@recall/contracts";
import type { z } from "zod";

export const addVocabularyDto = addVocabularyCommandSchema;

export type AddVocabularyDto = z.output<typeof addVocabularyDto>;
